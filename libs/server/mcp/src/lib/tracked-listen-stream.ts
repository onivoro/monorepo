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

const encoder = new TextEncoder();

/**
 * One `subscriptions/listen` stream, from the moment its request arrives to the end of its
 * response. The SDK serves the stream itself and has no way to end one of them, so the
 * service passes the SDK's response body through this, which can.
 *
 * Closing is graceful, as the SDK's own shutdown is: after the acknowledgement (the stream's
 * first frame), the listen request's result, which the client reads as the server ending the
 * subscription, then the end of the response. Nothing the SDK writes after that is sent, and
 * the SDK's side is cancelled, which unsubscribes it from change events.
 */
export class TrackedListenStream {
  readonly info: McpListenStream;
  private state: 'opening' | 'open' | 'closed' = 'opening';
  private closeWanted = false;
  private acknowledged = false;
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
      ...(authInfo && { authInfo }),
      openedAt: Date.now(),
    });
  }

  /** Whether a close was asked for before the stream opened. */
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

  private async pull(
    controller: ReadableStreamDefaultController<Uint8Array>,
  ): Promise<void> {
    if (this.closed || !this.reader) return;
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
      this.finish();
      controller.close();
      return;
    }
    controller.enqueue(chunk.value);
    if (!this.acknowledged) {
      this.acknowledged = true;
      if (this.closeWanted) this.close();
    }
  }

  /**
   * Close it as the server. Before it opens, or before its acknowledgement has gone out, the
   * close happens as soon as it can: an opening stream is refused, and an open one is closed
   * right after its acknowledgement.
   */
  close(): void {
    if (this.state === 'closed') return;
    if (this.state === 'opening' || !this.acknowledged) {
      this.closeWanted = true;
      return;
    }
    this.finish();
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
