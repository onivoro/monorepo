import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for VSCode command handler methods.
 */
export const COMMAND_HANDLER_METADATA = 'COMMAND_HANDLER_METADATA';

/**
 * Metadata stored for each command handler.
 */
export interface CommandHandlerMetadata {
  /** The full command ID (e.g., 'myExtension.myCommand') */
  command: string;
}

/**
 * Decorator to mark a method as a VSCode command handler.
 *
 * Use this decorator on methods within an @Injectable() service
 * to register them as handlers for VSCode commands.
 *
 * The decorated method will be called when the command is executed.
 * It can optionally receive arguments passed to the command.
 *
 * @param command - The full command ID (e.g., 'myExtension.myCommand')
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class MyCommandsService {
 *   @CommandHandler('myExtension.sayHello')
 *   async sayHello(): Promise<void> {
 *     vscode.window.showInformationMessage('Hello!');
 *   }
 *
 *   @CommandHandler('myExtension.openFile')
 *   async openFile(uri: vscode.Uri): Promise<void> {
 *     const doc = await vscode.workspace.openTextDocument(uri);
 *     await vscode.window.showTextDocument(doc);
 *   }
 *
 *   @CommandHandler('myExtension.processSelection')
 *   async processSelection(text: string, options?: ProcessOptions): Promise<string> {
 *     // Commands can receive multiple arguments and return values
 *     return text.toUpperCase();
 *   }
 * }
 * ```
 */
export function CommandHandler(command: string): MethodDecorator {
  return SetMetadata(COMMAND_HANDLER_METADATA, {
    command,
  } as CommandHandlerMetadata);
}
