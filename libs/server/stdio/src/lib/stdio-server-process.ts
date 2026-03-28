import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  isJsonRpcNotification,
  JSONRPC_VERSION,
} from '@onivoro/isomorphic-jsonrpc';
import { RequestCorrelator } from './request-correlator';
import { StdioServerProcessConfig } from './stdio-server-process-config';
import {
  StdioLogNotification,
  isStdioLogNotification,
} from './stdio-log-message';

/**
 * Type for notification callback handlers.
 */
export type ServerNotificationHandler<T = unknown> = (
  params: T,
) => void | Promise<void>;

/**
 * Manages a child process that communicates via stdio using JSON-RPC style messages.
 *
 * This class handles:
 * - Spawning and lifecycle management of the child process
 * - Sending requests and receiving responses via stdio
 * - Request-response correlation with timeouts
 * - Buffered line-based message parsing
 *
 * @example
 * ```typescript
 * const server = new StdioServerProcess({
 *   onStderr: (data) => console.error(data),
 *   onExit: (code) => console.log(`Process exited: ${code}`),
 * });
 *
 * server.start('/path/to/extension', 'dist/main.js');
 *
 * const result = await server.sendRequest('health', {});
 * console.log(result); // { status: 'ok' }
 *
 * server.stop();
 * ```
 */
export class StdioServerProcess {
  private process: ChildProcess | null = null;
  private correlator: RequestCorrelator;
  private buffer = '';
  private readonly config: Required<StdioServerProcessConfig>;
  private notificationHandlers: Map<string, Set<ServerNotificationHandler>> =
    new Map();

  constructor(config: StdioServerProcessConfig = {}) {
    this.config = {
      requestTimeoutMs: config.requestTimeoutMs ?? 30000,
      onStderr: config.onStderr ?? (() => {}),
      onExit: config.onExit ?? (() => {}),
      onError: config.onError ?? (() => {}),
      onLog: config.onLog ?? (() => {}),
    };
    this.correlator = new RequestCorrelator(this.config.requestTimeoutMs);
  }

  /**
   * Start the stdio server process.
   *
   * @param extensionPath - The root path of the extension
   * @param serverScript - Path to the server script (absolute or relative to extension root)
   * @param nodeArgs - Additional arguments to pass to node
   */
  start(
    extensionPath: string,
    serverScript: string,
    nodeArgs: string[] = [],
  ): void {
    if (this.process) {
      throw new Error('Server process is already running');
    }

    const serverPath = path.resolve(extensionPath, serverScript);

    this.process = spawn('node', [...nodeArgs, serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.setupProcessHandlers();
  }

  /**
   * Stop the server process.
   */
  stop(): void {
    if (this.process) {
      this.correlator.cancelAll(new Error('Server process stopped'));
      this.process.kill();
      this.process = null;
    }
  }

  /**
   * Check if the process is running.
   */
  get isRunning(): boolean {
    return this.process !== null;
  }

  /**
   * Send a request to the server and wait for a response.
   *
   * @param method - The method to call
   * @param params - Optional parameters
   * @param timeoutMs - Optional custom timeout
   */
  async sendRequest<T = unknown>(
    method: string,
    params?: unknown,
    timeoutMs?: number,
  ): Promise<T> {
    if (!this.process || !this.process.stdin) {
      throw new Error('Server process not running');
    }

    const { id, promise } = this.correlator.createRequest(timeoutMs);

    const request: JsonRpcRequest = {
      jsonrpc: JSONRPC_VERSION,
      id,
      method,
      params,
    };
    this.process.stdin.write(JSON.stringify(request) + '\n');

    return promise as Promise<T>;
  }

  /**
   * Register a handler for server-initiated notifications.
   *
   * Multiple handlers can be registered for the same notification type.
   * Returns a function to unregister the handler.
   *
   * @param notification - The notification type to listen for
   * @param handler - The handler function
   * @returns A function to unregister the handler
   *
   * @example
   * ```typescript
   * const unsubscribe = serverProcess.onNotification('file.changed', (data) => {
   *   console.log('File changed:', data);
   * });
   *
   * // Later, to stop listening:
   * unsubscribe();
   * ```
   */
  onNotification<T = unknown>(
    notification: string,
    handler: ServerNotificationHandler<T>,
  ): () => void {
    if (!this.notificationHandlers.has(notification)) {
      this.notificationHandlers.set(notification, new Set());
    }

    const handlers = this.notificationHandlers.get(notification)!;
    handlers.add(handler as ServerNotificationHandler);

    return () => {
      handlers.delete(handler as ServerNotificationHandler);
      if (handlers.size === 0) {
        this.notificationHandlers.delete(notification);
      }
    };
  }

  /**
   * Remove all handlers for a specific notification type.
   */
  offNotification(notification: string): void {
    this.notificationHandlers.delete(notification);
  }

  /**
   * Get all registered notification types.
   */
  getRegisteredNotifications(): string[] {
    return Array.from(this.notificationHandlers.keys());
  }

  /**
   * Set up handlers for process events.
   */
  private setupProcessHandlers(): void {
    if (!this.process) return;

    if (this.process.stdout) {
      this.process.stdout.on('data', (data: Buffer) => {
        this.handleStdoutData(data.toString());
      });
    }

    if (this.process.stderr) {
      this.process.stderr.on('data', (data: Buffer) => {
        this.config.onStderr(data.toString());
      });
    }

    this.process.on('exit', (code) => {
      this.correlator.cancelAll(
        new Error(`Server process exited with code ${code}`),
      );
      this.process = null;
      this.config.onExit(code);
    });

    this.process.on('error', (error) => {
      this.config.onError(error);
    });
  }

  /**
   * Handle incoming data from stdout.
   */
  private handleStdoutData(data: string): void {
    this.buffer += data;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        this.handleMessage(line);
      }
    }
  }

  /**
   * Handle a single message from stdout.
   */
  private handleMessage(line: string): void {
    try {
      const message:
        | JsonRpcResponse
        | JsonRpcNotification
        | StdioLogNotification = JSON.parse(line);

      // Check if this is a log notification (method === 'log')
      if (isStdioLogNotification(message)) {
        this.config.onLog(message.params);
        return;
      }

      // Check if this is a notification (has method but no id)
      if (isJsonRpcNotification(message)) {
        this.handleNotification(message);
        return;
      }

      // Otherwise treat as a response
      const response = message as JsonRpcResponse;

      if (response.id === undefined || response.id === null) {
        return;
      }

      // Convert id to string for correlator (it uses string keys internally)
      const idStr = String(response.id);

      if (response.error) {
        this.correlator.reject(
          idStr,
          new Error(response.error.message || 'Unknown error'),
        );
      } else {
        this.correlator.resolve(idStr, response.result);
      }
    } catch (error) {
      // Log parse errors but don't crash
      console.error('Failed to parse response:', line, error);
    }
  }

  /**
   * Handle an incoming notification from the server.
   */
  private async handleNotification(
    notification: JsonRpcNotification,
  ): Promise<void> {
    const handlers = this.notificationHandlers.get(notification.method);
    if (!handlers || handlers.size === 0) {
      return;
    }

    const promises = Array.from(handlers).map(async (handler) => {
      try {
        await handler(notification.params);
      } catch (error) {
        console.error(
          `Error in notification handler for "${notification.method}":`,
          error,
        );
      }
    });

    await Promise.all(promises);
  }
}
