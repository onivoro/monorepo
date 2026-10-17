import {
  SERVER_INFO_META_KEY,
  SUBSCRIPTION_ID_META_KEY,
} from '@modelcontextprotocol/server';
import type { McpAuthInfo } from './mcp-auth-info';
import type { McpListenStream } from './mcp-listen-stream';

/** The id of a `subscriptions/listen` request, or `undefined` for any other body. */
export function listenRequestId(body: unknown): string | number | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return undefined;
  }
  const message = body as { method?: unknown; id?: unknown };
  if (message.method !== 'subscriptions/listen') return undefined;
  return typeof message.id === 'string' || typeof message.id === 'number'
    ? message.id
    : undefined;
}

/**
 * A frozen copy of auth: plain objects and arrays are copied and frozen all the way down, a
 * `URL` is copied, and anything else is kept as is. Changing the copy can't change the
 * request's auth.
 */
export function frozenCopy<T>(value: T): T {
  if (value instanceof URL) return new URL(value.href) as T;
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => frozenCopy(item))) as T;
  }
  if (value && typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;
    const copy: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      copy[key] = frozenCopy(item);
    }
    return Object.freeze(copy) as T;
  }
  return value;
}

/**
 * Splits SSE text into whole events (each ending with its blank line) and the rest, an event
 * not yet complete. Lines end with `\r\n`, `\n` or `\r`; a `\r` at the very end might be the
 * first half of a `\r\n`, so it waits for more.
 */
export function splitSseEvents(text: string): {
  events: string[];
  rest: string;
} {
  const events: string[] = [];
  let start = 0;
  let lineStart = 0;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c !== '\r' && c !== '\n') {
      i++;
      continue;
    }
    let end = i + 1;
    if (c === '\r') {
      if (end >= text.length) break;
      if (text[end] === '\n') end++;
    }
    const blank = i === lineStart;
    lineStart = end;
    i = end;
    if (blank) {
      events.push(text.slice(start, end));
      start = end;
    }
  }
  return { events, rest: text.slice(start) };
}

/** The JSON-RPC method an SSE event's data carries, if it carries one. */
function sseEventMethod(event: string): string | undefined {
  const data = event
    .split(/\r\n|\r|\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(line.startsWith('data: ') ? 6 : 5))
    .join('\n');
  if (!data) return undefined;
  try {
    const method = (JSON.parse(data) as { method?: unknown }).method;
    return typeof method === 'string' ? method : undefined;
  } catch {
    return undefined;
  }
}

const ACKNOWLEDGED = 'notifications/subscriptions/acknowledged';
const encoder = new TextEncoder();

/**
 * One `subscriptions/listen` stream, from the moment its request arrives to the end of its
 * response. The SDK serves the stream itself and has no way to end one of them, so the
 * service passes the SDK's response body through this, which can.
 *
 * It forwards whole SSE events only, however the SDK's bytes are chunked, holding back an
 * event until its blank line arrives, so the stream is always between events and a close
 * never lands inside one.
 *
 * Closing is graceful, as the SDK's own shutdown is: after the acknowledgement (the
 * `notifications/subscriptions/acknowledged` event, whatever comes before it), the listen
 * request's result, which the client reads as the server ending the subscription, then the
 * end of the response. Nothing the SDK writes after that is sent, and the SDK's side is
 * cancelled, which unsubscribes it from change events.
 */
export class TrackedListenStream {
  readonly info: McpListenStream;
  /** Why it was refused before opening, once it was. */
  refusal?: string;
  /** Resolves when a close is asked for. */
  readonly whenCloseRequested: Promise<void>;
  private resolveCloseRequested!: () => void;
  private state: 'opening' | 'open' | 'closed' = 'opening';
  private closeWanted = false;
  private acknowledged = false;
  private pending = '';
  private readonly decoder = new TextDecoder();
  private reader?: ReadableStreamDefaultReader<Uint8Array>;
  private controller?: ReadableStreamDefaultController<Uint8Array>;

  constructor(
    subscriptionId: string | number,
    authInfo: McpAuthInfo | undefined,
    private readonly serverInfo: Record<string, unknown>,
    private readonly onFinished: (stream: TrackedListenStream) => void,
  ) {
    this.info = Object.freeze({
      subscriptionId,
      ...(authInfo && { authInfo: frozenCopy(authInfo) }),
      openedAt: Date.now(),
    });
    this.whenCloseRequested = new Promise<void>((resolve) => {
      this.resolveCloseRequested = resolve;
    });
  }

  /** Whether a close was asked for (or it has ended). */
  get closeRequested(): boolean {
    return this.closeWanted || this.state === 'closed';
  }

  /** Ends it without a stream: the request was refused, or the SDK didn't open one. */
  abandon(): void {
    this.finish();
  }

  /** The SDK's event-stream response, passed through this stream. */
  wrap(response: Response): Response {
    if (!response.body || this.state !== 'opening') {
      this.finish();
      return response;
    }
    this.reader = response.body.getReader();
    this.state = 'open';
    const body = new ReadableStream<Uint8Array>({
      start: (controller) => {
        this.controller = controller;
      },
      pull: (controller) => this.pull(controller),
      cancel: async (reason) => {
        // The client went away.
        this.finish();
        await this.reader?.cancel(reason).catch(() => undefined);
      },
    });
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  /** Forwards the next whole events, reading as many chunks as that takes. */
  private async pull(
    controller: ReadableStreamDefaultController<Uint8Array>,
  ): Promise<void> {
    while (!this.closed && this.reader) {
      let chunk: Awaited<
        ReturnType<ReadableStreamDefaultReader<Uint8Array>['read']>
      >;
      try {
        chunk = await this.reader.read();
      } catch (error) {
        if (this.closed) return;
        this.finish();
        controller.error(error);
        return;
      }
      // Closed while waiting: close() has already ended the response.
      if (this.closed) return;
      if (chunk.done) {
        // Whatever is left (an incomplete event) goes out as the SDK wrote it.
        const rest = this.pending + this.decoder.decode();
        this.pending = '';
        if (rest) controller.enqueue(encoder.encode(rest));
        this.finish();
        controller.close();
        return;
      }

      const { events, rest } = splitSseEvents(
        this.pending + this.decoder.decode(chunk.value, { stream: true }),
      );
      this.pending = rest;
      if (events.length === 0) continue;

      controller.enqueue(encoder.encode(events.join('')));
      if (
        !this.acknowledged &&
        events.some((event) => sseEventMethod(event) === ACKNOWLEDGED)
      ) {
        this.acknowledged = true;
      }
      if (this.acknowledged && this.closeWanted) this.close();
      return;
    }
  }

  /**
   * Close it as the server. Before it opens, or before its acknowledgement has gone out, the
   * close happens as soon as it can: an opening stream is refused, and an open one is closed
   * right after its acknowledgement.
   */
  close(): void {
    if (this.state === 'closed') return;
    if (!this.closeWanted) {
      this.closeWanted = true;
      this.resolveCloseRequested();
    }
    if (this.state === 'opening' || !this.acknowledged) return;

    this.finish();
    // An incomplete event the SDK was writing is dropped; the stream is between events.
    this.pending = '';
    const controller = this.controller;
    if (controller) {
      const result = {
        jsonrpc: '2.0',
        id: this.info.subscriptionId,
        result: {
          resultType: 'complete',
          _meta: {
            [SUBSCRIPTION_ID_META_KEY]: this.info.subscriptionId,
            [SERVER_INFO_META_KEY]: this.serverInfo,
          },
        },
      };
      try {
        controller.enqueue(
          encoder.encode(`event: message\ndata: ${JSON.stringify(result)}\n\n`),
        );
        controller.close();
      } catch {
        // The response is already gone.
      }
    }
    // The SDK's side: cancelling it unsubscribes it from change events and stops its keepalive.
    this.reader?.cancel().catch(() => undefined);
  }

  /** A getter, so that TypeScript doesn't narrow it across an await. */
  private get closed(): boolean {
    return this.state === 'closed';
  }

  private finish(): void {
    if (this.state === 'closed') return;
    this.state = 'closed';
    this.onFinished(this);
  }
}
