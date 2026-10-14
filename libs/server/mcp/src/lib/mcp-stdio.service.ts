import { Injectable } from '@nestjs/common';
import type { McpServer } from '@modelcontextprotocol/server';
import type { McpProtocolEra } from './mcp-protocol-era';

interface McpStdioConnection {
  server: McpServer;
  era: McpProtocolEra;
  ready: boolean;
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
  private connection?: McpStdioConnection;
  private waiters: Array<() => void> = [];

  /**
   * Whether a client is connected and ready for notifications: on a 2025-era connection, once
   * the client has sent `notifications/initialized`; on a 2026-07-28 one, once the server is
   * connected.
   */
  isConnected(): boolean {
    const connection = this.connection;
    return !!connection && connection.ready && connection.server.isConnected();
  }

  /** The era the connected client speaks, or `undefined` before one connects. */
  getProtocolEra(): McpProtocolEra | undefined {
    return this.connection?.era;
  }

  /** Resolves once a client is connected and ready (at once if one already is). */
  whenConnected(): Promise<void> {
    if (this.isConnected()) return Promise.resolve();
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  /**
   * Sends a notification to the connected client, outside any request. Custom (non-spec)
   * methods pass through unchanged in both eras; spec methods are checked against the
   * negotiated era and the server's capabilities by the SDK, as for any notification.
   *
   * Resolves `true` once the message is written to the transport (not when the client has
   * processed it), or `false`, without sending, when no client is connected yet or any more.
   * Nothing is queued: wait with `whenConnected()` if the message must not be dropped.
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
    await this.connection!.server.server.notification({
      method,
      ...(params !== undefined && { params }),
    });
    return true;
  }

  /**
   * Called by `McpStdioModule` for each server it builds. Not for application code.
   * Returns the function that detaches the server when it closes.
   * @internal
   */
  attach(server: McpServer, era: McpProtocolEra): () => void {
    const connection: McpStdioConnection = { server, era, ready: false };
    this.connection = connection;
    if (era === 'legacy') {
      // A 2025-era client takes notifications once it has finished the handshake.
      const previous = server.server.oninitialized;
      server.server.oninitialized = () => {
        previous?.();
        this.markReady(connection);
      };
    } else {
      // A 2026-07-28 server is ready once `serveStdio` has connected it.
      const connect = server.connect.bind(server);
      server.connect = async (...args: Parameters<McpServer['connect']>) => {
        await connect(...args);
        this.markReady(connection);
      };
    }
    return () => {
      if (this.connection === connection) this.connection = undefined;
    };
  }

  private markReady(connection: McpStdioConnection): void {
    connection.ready = true;
    if (this.connection !== connection || !this.isConnected()) return;
    const waiters = this.waiters;
    this.waiters = [];
    waiters.forEach((resolve) => resolve());
  }
}
