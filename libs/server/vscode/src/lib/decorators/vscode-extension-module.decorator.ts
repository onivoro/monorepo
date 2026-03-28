import { Type } from '@nestjs/common';
import { BaseWebviewProvider } from '../classes/base-webview-provider';
import type * as vscode from 'vscode';

/**
 * Metadata key for storing extension configuration on a module class.
 */
export const VSCODE_EXTENSION_MODULE_METADATA = Symbol(
  'VSCODE_EXTENSION_MODULE_METADATA',
);

/**
 * Configuration for a VSCode extension module.
 */
export interface VscodeExtensionModuleConfig<
  TWebviewProvider extends BaseWebviewProvider = BaseWebviewProvider,
> {
  /** Display name for logging (e.g., "MyExtension") */
  name: string;

  /** Relative path to server script from extension root */
  serverScript: string;

  /** The viewType string for webview registration */
  webviewViewType: string;

  /** Factory to create the webview provider instance */
  createWebviewProvider: (extensionUri: vscode.Uri) => TWebviewProvider;

  /**
   * Provider tokens for command handler services.
   * These services should have methods decorated with @CommandHandler.
   */
  commandHandlerTokens: Type[];

  /** Optional server process configuration */
  serverConfig?: {
    requestTimeoutMs?: number;
  };

  /**
   * Server output channel configuration.
   * If provided, server logs will be displayed in a dedicated VSCode OutputChannel.
   */
  serverOutputChannel?: {
    /** Name for the output channel (shown in VSCode's Output panel) */
    name: string;
    /** Whether to show the output channel when an error is logged */
    showOnError?: boolean;
  };

  /** Logging callbacks (defaults to console) */
  logging?: {
    log?: (message: string) => void;
    error?: (message: string) => void;
  };
}

/**
 * Decorator that marks a NestJS module as a VSCode extension module.
 *
 * This decorator stores configuration metadata on the module class that
 * is used by `createExtensionFromModule` to bootstrap the extension.
 *
 * @example
 * ```typescript
 * @VscodeExtensionModule({
 *   name: 'MyExtension',
 *   serverScript: 'dist/main.js',
 *   webviewViewType: 'myExtension.webview',
 *   createWebviewProvider: (uri) => new MyWebviewProvider(uri),
 *   commandHandlerTokens: [MyCommandHandlerService],
 *   serverOutputChannel: { name: 'My Extension Server', showOnError: true },
 * })
 * @Module({
 *   providers: [MyCommandHandlerService, MyNotificationListener],
 * })
 * export class MyExtensionModule {}
 * ```
 */
export function VscodeExtensionModule<
  TWebviewProvider extends BaseWebviewProvider,
>(config: VscodeExtensionModuleConfig<TWebviewProvider>): ClassDecorator {
  return (target: object) => {
    Reflect.defineMetadata(VSCODE_EXTENSION_MODULE_METADATA, config, target);
  };
}

/**
 * Get the extension configuration from a module class.
 */
export function getExtensionModuleConfig<
  TWebviewProvider extends BaseWebviewProvider = BaseWebviewProvider,
>(
  moduleClass: Type,
): VscodeExtensionModuleConfig<TWebviewProvider> | undefined {
  return Reflect.getMetadata(VSCODE_EXTENSION_MODULE_METADATA, moduleClass);
}
