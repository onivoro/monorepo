import { Injectable, Logger } from '@nestjs/common';
import {
  isJSONRPCNotification,
  isJSONRPCRequest,
  PROTOCOL_VERSION_META_KEY,
} from '@modelcontextprotocol/server';
import type {
  JSONRPCMessage,
  McpServer,
  MessageExtraInfo,
  Transport,
  TransportSendOptions,
} from '@modelcontextprotocol/server';
import type { McpProtocolEra } from './mcp-protocol-era';

/** Rejects `McpStdioService.whenConnected()` once the stdio connection has closed. */
export class McpStdioClosedError extends Error {
  constructor() {
    super('The MCP stdio connection is closed');
    this.name = 'McpStdioClosedError';
  }
}

interface McpStdioConnection {
  server: McpServer;
  era: McpProtocolEra;
  ready: boolean;
}

interface Waiter {
  resolve(): void;
  reject(error: unknown): void;
}

/**
 * The client connection `McpStdioModule` serves, for application code that sends the client
 * messages of its own: custom notifications, such as a Claude Code channel's
 * `notifications/claude/channel`. Provided and exported by `McpStdioModule`.
 *
 * The server is built when the client's first message arrives, so right after startup there
 * is no client to send to. `sendNotification` then resolves `false`; `whenConnected()` waits
 * for one.
 */
@Injectable()
export class McpStdioService {
  private readonly logger = new Logger(McpStdioService.name);
  private connection?: McpStdioConnection;
  private closed = false;
  private readonly waiters = new Set<Waiter>();
  /** Whether the client has made a 2026-07-28 request other than `server/discover`. */
  private modernChosen = false;

  /**
   * Whether a client is connected and ready for notifications: once the connection has
   * settled on an era, which a client can probe before choosing. On a 2025-era connection
   * that is when the client has sent `notifications/initialized`; on a 2026-07-28 one, when
   * the client has made a 2026-07-28 request other than the `server/discover` probe.
   */
  isConnected(): boolean {
    const connection = this.connection;
    return (
      !this.closed &&
      !!connection &&
      connection.ready &&
      connection.server.isConnected()
    );
  }

  /**
   * The era of the server the client is talking to, or `undefined` before one is built.
   * During a `server/discover` probe this is `'modern'`, even if the client then falls back.
   */
  getProtocolEra(): McpProtocolEra | undefined {
    return this.connection?.era;
  }

  /**
   * Resolves once a client is connected and ready (at once if one already is). Rejects with
   * `McpStdioClosedError` once the connection has closed (the client went away or the module
   * shut down), and with the signal's reason if `signal` aborts first.
   */
  whenConnected(signal?: AbortSignal): Promise<void> {
    if (this.isConnected()) return Promise.resolve();
    if (this.closed) return Promise.reject(new McpStdioClosedError());
    if (signal?.aborted) return Promise.reject(abortReason(signal));
    return new Promise<void>((resolve, reject) => {
      const onAbort = () => waiter.reject(abortReason(signal!));
      const settle = () => {
        this.waiters.delete(waiter);
        signal?.removeEventListener('abort', onAbort);
      };
      const waiter: Waiter = {
        resolve: () => {
          settle();
          resolve();
        },
        reject: (error) => {
          settle();
          reject(error);
        },
      };
      this.waiters.add(waiter);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  /**
   * Sends a notification to the connected client, outside any request. Custom (non-spec)
   * methods pass through unchanged in both eras; spec methods are checked against the
   * negotiated era and the server's capabilities by the SDK, as for any notification.
   *
   * Resolves `true` once the message is written to the transport (not when the client has
   * processed it), and `false` when it wasn't sent: no client is ready yet or any more, or
   * the SDK or transport refused it (logged as a warning). It never rejects. Nothing is
   * queued: wait with `whenConnected()` if the message must not be dropped.
   *
   * @example
   * await stdio.sendNotification('notifications/claude/channel', {
   *   content: 'build failed on main',
   *   meta: { severity: 'high' },
   * });
   */
  async sendNotification(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<boolean> {
    if (!this.isConnected()) return false;
    try {
      await this.connection!.server.server.notification({
        method,
        ...(params !== undefined && { params }),
      });
      return true;
    } catch (error) {
      this.logger.warn(`Could not send ${method}: ${String(error)}`);
      return false;
    }
  }

  /**
   * Wraps the stdio transport so the service sees the connection settle and close.
   * Called by `McpStdioModule`; not for application code.
   * @internal
   */
  observe(transport: Transport): Transport {
    return new ObservedTransport(transport, {
      inbound: (message) => this.onInbound(message),
      outbound: () => this.onOutbound(),
      closed: () => this.close(),
    });
  }

  /**
   * Records a server the module built. Returns the function that forgets it when it closes
   * (a discarded `server/discover` probe server, say), which doesn't close the connection.
   * Called by `McpStdioModule`; not for application code.
   * @internal
   */
  attach(server: McpServer, era: McpProtocolEra): () => void {
    const connection: McpStdioConnection = { server, era, ready: false };
    this.connection = connection;
    return () => {
      if (this.connection === connection) this.connection = undefined;
    };
  }

  /**
   * Marks the connection closed: nothing more is sent, and pending and later
   * `whenConnected()` calls reject. Called when the transport closes and on module shutdown.
   * @internal
   */
  close(): void {
    this.closed = true;
    this.connection = undefined;
    for (const waiter of [...this.waiters]) {
      waiter.reject(new McpStdioClosedError());
    }
  }

  private onInbound(message: JSONRPCMessage): void {
    const connection = this.connection;
    if (isJSONRPCRequest(message)) {
      // A 2026-07-28 request (one carrying the per-request protocol version claim) other
      // than the probe means the client has chosen that era, and `serveStdio` pins the
      // connection on it. A client that probes and falls back sends `initialize` (or a
      // `ping`) without the claim, which mustn't make the probe server ready.
      if (
        message.method !== 'server/discover' &&
        claimsModernProtocol(message.params)
      ) {
        this.modernChosen = true;
        this.markModernReady();
      }
    } else if (
      isJSONRPCNotification(message) &&
      message.method === 'notifications/initialized' &&
      connection?.era === 'legacy'
    ) {
      // The 2025-era handshake is complete. The server was connected before `initialize`
      // reached it, so it is ready now.
      this.markReady(connection);
    }
  }

  /**
   * When a 2026-07-28 client opens with a request other than `server/discover`, the server
   * for it is built and connected only after that request arrives, so readiness waits for the
   * first message it sends (its answer, or the acknowledgement of `subscriptions/listen`).
   */
  private onOutbound(): void {
    this.markModernReady();
  }

  private markModernReady(): void {
    const connection = this.connection;
    if (
      this.modernChosen &&
      connection?.era === 'modern' &&
      connection.server.isConnected()
    ) {
      this.markReady(connection);
    }
  }

  private markReady(connection: McpStdioConnection): void {
    if (connection.ready) return;
    connection.ready = true;
    if (this.connection !== connection || !this.isConnected()) return;
    for (const waiter of [...this.waiters]) waiter.resolve();
  }
}

function claimsModernProtocol(params: unknown): boolean {
  const meta = (params as { _meta?: unknown } | undefined)?._meta;
  return (
    typeof meta === 'object' &&
    meta !== null &&
    PROTOCOL_VERSION_META_KEY in meta
  );
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new Error('The operation was aborted');
}

/**
 * A transport that passes everything through to another one, and reports each message it
 * receives, each message it has sent, and its closing. `serveStdio` and `McpServer.connect`
 * accept any `Transport`, so this relies on nothing but that interface.
 */
class ObservedTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: <T extends JSONRPCMessage>(
    message: T,
    extra?: MessageExtraInfo,
  ) => void;

  constructor(
    private readonly inner: Transport,
    private readonly observer: {
      inbound(message: JSONRPCMessage): void;
      outbound(message: JSONRPCMessage): void;
      closed(): void;
    },
  ) {
    inner.onmessage = (message, extra) => {
      observer.inbound(message);
      this.onmessage?.(message, extra);
    };
    inner.onerror = (error) => this.onerror?.(error);
    inner.onclose = () => {
      this.onclose?.();
      observer.closed();
    };
  }

  get sessionId(): string | undefined {
    return this.inner.sessionId;
  }

  start(): Promise<void> {
    return this.inner.start();
  }

  async send(
    message: JSONRPCMessage,
    options?: TransportSendOptions,
  ): Promise<void> {
    await this.inner.send(message, options);
    this.observer.outbound(message);
  }

  close(): Promise<void> {
    return this.inner.close();
  }

  setProtocolVersion = (version: string): void => {
    this.inner.setProtocolVersion?.(version);
  };
}
