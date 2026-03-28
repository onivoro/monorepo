import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for server notification handler decorator.
 */
export const SERVER_NOTIFICATION_HANDLER_METADATA =
  'SERVER_NOTIFICATION_HANDLER_METADATA';

/**
 * Metadata stored by the @ServerNotificationHandler decorator.
 */
export interface ServerNotificationHandlerMetadata {
  /** The notification method name this handler responds to */
  method: string;
}

/**
 * Decorator to mark a method as a handler for server notifications.
 *
 * Methods decorated with @ServerNotificationHandler are automatically discovered
 * and registered to handle notifications from the stdio server process.
 *
 * Unlike @WebviewHandler (which handles request/response), this decorator handles
 * notifications (fire-and-forget messages from the server).
 *
 * @param method - The notification method name to handle (e.g., 'showMessage', 'taskProgress')
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class MyServerNotificationHandlerService {
 *   constructor(@Inject(VSCODE_API) private readonly vscode: VscodeApi) {}
 *
 *   @ServerNotificationHandler('showMessage')
 *   async handleShowMessage(params: { message: string; type?: string }) {
 *     await this.vscode.window.showInformationMessage(params.message);
 *   }
 *
 *   @ServerNotificationHandler('taskProgress')
 *   handleTaskProgress(params: { taskId: string; progress: number }) {
 *     console.log(`Task ${params.taskId}: ${params.progress}%`);
 *   }
 * }
 * ```
 *
 * The server can trigger these handlers by sending notifications:
 * ```typescript
 * // In the stdio server
 * this.messageBus.sendNotification('extension.showMessage', {
 *   message: 'Hello from server!',
 *   type: 'info',
 * });
 * ```
 */
export function ServerNotificationHandler(method: string): MethodDecorator {
  return SetMetadata(SERVER_NOTIFICATION_HANDLER_METADATA, {
    method,
  } satisfies ServerNotificationHandlerMetadata);
}
