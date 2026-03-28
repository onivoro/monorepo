import { Injectable, Inject } from '@nestjs/common';
import {
  VSCODE_API,
  VSCODE_EXTENSION_CONTEXT,
} from './vscode-injection-tokens';
import {
  VscodeApi,
  VscodeExtensionContext,
  VscodeDisposable,
  VscodeTextEditor,
  VscodeTextEditorEdit,
} from './vscode-api-type';

/**
 * Injectable service that wraps VSCode commands API.
 *
 * Provides a NestJS-friendly interface to vscode.commands.
 *
 * @example
 * ```typescript
 * @Injectable()
 * class MyService {
 *   constructor(private readonly commands: VscodeCommandsService) {}
 *
 *   async doSomething() {
 *     await this.commands.executeCommand('workbench.action.files.save');
 *   }
 * }
 * ```
 */
@Injectable()
export class VscodeCommandsService {
  constructor(
    @Inject(VSCODE_API) private readonly vscodeApi: VscodeApi,
    @Inject(VSCODE_EXTENSION_CONTEXT)
    private readonly context: VscodeExtensionContext,
  ) {}

  /**
   * Execute a VSCode command.
   */
  async executeCommand<T = unknown>(
    command: string,
    ...args: unknown[]
  ): Promise<T | undefined> {
    return this.vscodeApi.commands.executeCommand<T>(command, ...args);
  }

  /**
   * Register a command handler.
   * The command is automatically added to the extension's subscriptions.
   */
  registerCommand(
    command: string,
    callback: (...args: unknown[]) => unknown,
  ): VscodeDisposable {
    const disposable = this.vscodeApi.commands.registerCommand(
      command,
      callback,
    );
    this.context.subscriptions.push(disposable);
    return disposable;
  }

  /**
   * Register a text editor command.
   */
  registerTextEditorCommand(
    command: string,
    callback: (
      textEditor: VscodeTextEditor,
      edit: VscodeTextEditorEdit,
      ...args: unknown[]
    ) => void,
  ): VscodeDisposable {
    const disposable = this.vscodeApi.commands.registerTextEditorCommand(
      command,
      callback,
    );
    this.context.subscriptions.push(disposable);
    return disposable;
  }

  /**
   * Get all available commands.
   */
  async getCommands(filterInternal?: boolean): Promise<string[]> {
    return this.vscodeApi.commands.getCommands(filterInternal);
  }
}
