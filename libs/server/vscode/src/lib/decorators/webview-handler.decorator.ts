import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for webview handler methods.
 */
export const WEBVIEW_HANDLER_METADATA = 'WEBVIEW_HANDLER_METADATA';

/**
 * Metadata stored for each webview handler.
 */
export interface WebviewHandlerMetadata {
  /** The method name to handle */
  method: string;
}

/**
 * Decorator to mark a method as a webview message handler.
 *
 * Use this decorator on methods within an @Injectable() service
 * to register them as handlers for specific webview message method calls.
 * This allows the extension to handle messages from the webview directly,
 * without routing them to the stdio server.
 *
 * @param method - The RPC method name to handle (e.g., 'getState', 'extension.selectFile')
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class WebviewHandlerService {
 *   constructor(
 *     @Inject(VSCODE_API) private readonly vscode: VscodeApi,
 *     private readonly workspace: VscodeWorkspaceService,
 *   ) {}
 *
 *   @WebviewHandler('extension.selectFile')
 *   async selectFile(): Promise<{ path: string } | null> {
 *     const files = await this.vscode.window.showOpenDialog({
 *       canSelectFiles: true,
 *       canSelectMany: false,
 *     });
 *     return files?.[0] ? { path: files[0].fsPath } : null;
 *   }
 *
 *   @WebviewHandler('extension.showMessage')
 *   async showMessage(params: { message: string }): Promise<void> {
 *     await this.vscode.window.showInformationMessage(params.message);
 *   }
 * }
 * ```
 */
export function WebviewHandler(method: string): MethodDecorator {
  return SetMetadata(WEBVIEW_HANDLER_METADATA, {
    method,
  } as WebviewHandlerMetadata);
}
