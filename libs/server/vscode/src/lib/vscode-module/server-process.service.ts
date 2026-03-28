import { Injectable, Inject } from '@nestjs/common';
import { StdioServerProcess } from '@onivoro/server-stdio';
import { STDIO_SERVER_PROCESS } from './vscode-injection-tokens';

/**
 * Type for server notification callback handlers.
 */
export type NotificationHandler<T = unknown> = (
  data: T,
) => void | Promise<void>;

/**
 * Injectable service that provides access to the stdio server process.
 *
 * This service allows extension-side NestJS services to:
 * - Send requests to the backend server
 * - Register handlers for server-initiated notifications
 *
 * @example
 * ```typescript
 * @Injectable()
 * class MyService {
 *   constructor(private readonly server: ServerProcessService) {}
 *
 *   async fetchData() {
 *     return this.server.sendRequest('data.fetch', { id: 123 });
 *   }
 *
 *   onModuleInit() {
 *     this.server.onNotification('data.updated', (data) => {
 *       console.log('Data updated:', data);
 *     });
 *   }
 * }
 * ```
 */
@Injectable()
export class ServerProcessService {
  constructor(
    @Inject(STDIO_SERVER_PROCESS)
    private readonly serverProcess: StdioServerProcess,
  ) {}

  /**
   * Send a request to the server and wait for a response.
   *
   * @param method - The method name to call
   * @param params - Optional parameters
   * @param timeoutMs - Optional custom timeout
   */
  async sendRequest<T = unknown>(
    method: string,
    params?: unknown,
    timeoutMs?: number,
  ): Promise<T> {
    return this.serverProcess.sendRequest<T>(method, params, timeoutMs);
  }

  /**
   * Check if the server process is running.
   */
  get isRunning(): boolean {
    return this.serverProcess.isRunning;
  }

  /**
   * Register a handler for server-initiated notifications.
   *
   * Multiple handlers can be registered for the same notification type.
   * Returns a function to unregister the handler.
   *
   * This delegates to the underlying StdioServerProcess which handles
   * the actual notification dispatch.
   *
   * @param notification - The notification type to listen for
   * @param handler - The handler function
   * @returns A function to unregister the handler
   */
  onNotification<T = unknown>(
    notification: string,
    handler: NotificationHandler<T>,
  ): () => void {
    return this.serverProcess.onNotification(notification, handler);
  }

  /**
   * Get all registered notification types.
   */
  getRegisteredNotifications(): string[] {
    return this.serverProcess.getRegisteredNotifications();
  }
}
