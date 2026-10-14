import { Injectable, Logger } from '@nestjs/common';
import {
  isJSONRPCErrorResponse,
  isJSONRPCNotification,
  isJSONRPCRequest,
  isJSONRPCResultResponse,
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

type RequestId = string | number;

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
  /** Methods of the requests not yet answered, by id, until the connection is ready. */
  private readonly openRequests = new Map<RequestId, string>();

  /**
   * Whether a client is connected and ready for notifications: once the connection has
   * settled on an era, which a client can probe before choosing. On a 2025-era connection
   * that is when the client has sent `notifications/initialized`; on a 2026-07-28 one, when
   * the server has answered a request other than the `server/discover` probe.
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
      outbound: (message) => this.onOutbound(message),
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
    this.openRequests.clear();
    for (const waiter of [...this.waiters]) {
      waiter.reject(new McpStdioClosedError());
    }
  }

  private onInbound(message: JSONRPCMessage): void {
    const connection = this.connection;
    if (isJSONRPCRequest(message)) {
      if (!connection?.ready) this.openRequests.set(message.id, message.method);
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

  private onOutbound(message: JSONRPCMessage): void {
    if (!isJSONRPCResultResponse(message) && !isJSONRPCErrorResponse(message)) {
      return;
    }
    if (message.id === undefined) return;
    const method = this.openRequests.get(message.id);
    if (method === undefined) return;
    this.openRequests.delete(message.id);
    // A 2026-07-28 server answering anything but the `server/discover` probe is the one the
    // connection is pinned to. A client can probe and then fall back to `initialize`.
    const connection = this.connection;
    if (connection?.era === 'modern' && method !== 'server/discover') {
      this.markReady(connection);
    }
  }

  private markReady(connection: McpStdioConnection): void {
    if (connection.ready) return;
    connection.ready = true;
    this.openRequests.clear();
    if (this.connection !== connection || !this.isConnected()) return;
    for (const waiter of [...this.waiters]) waiter.resolve();
  }
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
