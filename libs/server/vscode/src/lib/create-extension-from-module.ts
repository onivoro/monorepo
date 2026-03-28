import type * as vscode from 'vscode';
import { NestFactory } from '@nestjs/core';
import { Type, DynamicModule, INestApplicationContext } from '@nestjs/common';
import { StdioServerProcess, StdioLogParams } from '@onivoro/server-stdio';
import { BaseWebviewProvider } from './classes/base-webview-provider';
import { CommandRegistry } from './command-registry';
import { VscodeExtensionInstance } from './types/vscode-extension-instance';
import { VscodeModule } from './vscode-module';
import { ExtensionMessageBus } from './extension-message-bus';
import {
  getExtensionModuleConfig,
  VscodeExtensionModuleConfig,
} from './decorators/vscode-extension-module.decorator';

/**
 * Creates a VSCode extension from a NestJS module decorated with @VscodeExtensionModule.
 *
 * This is the simplest way to create a VSCode extension with NestJS.
 * All configuration is declared on the module class itself using the
 * @VscodeExtensionModule decorator.
 *
 * @example
 * ```typescript
 * // extension.ts
 * import 'reflect-metadata';
 * import { createExtensionFromModule } from '@onivoro/server-vscode';
 * import { MyExtensionModule } from './app/my-extension.module';
 *
 * export const { activate, deactivate } = createExtensionFromModule(MyExtensionModule);
 * ```
 *
 * @example
 * ```typescript
 * // my-extension.module.ts
 * import { Module } from '@nestjs/common';
 * import { VscodeExtensionModule } from '@onivoro/server-vscode';
 *
 * @VscodeExtensionModule({
 *   name: 'MyExtension',
 *   serverScript: 'dist/main.js',
 *   webviewViewType: 'myExtension.webview',
 *   createWebviewProvider: (uri) => new MyWebviewProvider(uri),
 *   commandHandlerTokens: [MyCommandHandlerService],
 *   serverOutputChannel: { name: 'My Extension Server' },
 * })
 * @Module({
 *   providers: [MyCommandHandlerService],
 * })
 * export class MyExtensionModule {}
 * ```
 */
export function createExtensionFromModule<
  TWebviewProvider extends BaseWebviewProvider = BaseWebviewProvider,
>(moduleClass: Type): VscodeExtensionInstance {
  const config = getExtensionModuleConfig<TWebviewProvider>(moduleClass);

  if (!config) {
    throw new Error(
      `Module ${moduleClass.name} is not decorated with @VscodeExtensionModule. ` +
        `Add the decorator to configure your extension.`,
    );
  }

  return createExtensionWithConfig(moduleClass, config);
}

/**
 * Internal factory that creates the extension with the given configuration.
 */
function createExtensionWithConfig<
  TWebviewProvider extends BaseWebviewProvider,
>(
  moduleClass: Type,
  config: VscodeExtensionModuleConfig<TWebviewProvider>,
): VscodeExtensionInstance {
  let app: INestApplicationContext | null = null;
  let serverProcess: StdioServerProcess | null = null;
  let webviewProvider: TWebviewProvider;
  let serverOutputChannel: vscode.OutputChannel | null = null;

  const log = config.logging?.log ?? console.log;
  const logError = config.logging?.error ?? console.error;

  /**
   * Format a log message for the output channel.
   */
  function formatLogForChannel(logMsg: StdioLogParams): string {
    const levelLabel = {
      debug: '[DEBUG]',
      info: '[INFO] ',
      warn: '[WARN] ',
      error: '[ERROR]',
    }[logMsg.level];

    let timestamp: string;
    try {
      const date = new Date(logMsg.timestamp);
      timestamp = date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      timestamp = logMsg.timestamp;
    }

    return `${timestamp} ${levelLabel} ${logMsg.message}`;
  }

  async function activate(context: vscode.ExtensionContext): Promise<void> {
    log(`${config.name} extension is now active`);

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const vscode = require('vscode') as typeof import('vscode');
      const extensionUri = vscode.Uri.file(context.extensionPath);

      // Create output channel for server logs if configured
      if (config.serverOutputChannel) {
        serverOutputChannel = vscode.window.createOutputChannel(
          config.serverOutputChannel.name,
        );
        context.subscriptions.push(serverOutputChannel);
      }

      // Initialize stdio server process
      serverProcess = new StdioServerProcess({
        requestTimeoutMs: config.serverConfig?.requestTimeoutMs,
        onStderr: (data) => logError(data),
        onExit: (code) => log(`Server process exited with code ${code}`),
        onError: (error) => logError(`Server process error: ${error.message}`),
        onLog: (logMsg) => {
          if (serverOutputChannel) {
            serverOutputChannel.appendLine(formatLogForChannel(logMsg));

            // Auto-show on error if configured
            if (
              logMsg.level === 'error' &&
              config.serverOutputChannel?.showOnError
            ) {
              serverOutputChannel.show(true); // true = preserve focus
            }
          }
        },
      });

      serverProcess.start(context.extensionPath, config.serverScript);

      // Create webview provider
      webviewProvider = config.createWebviewProvider(extensionUri);

      // Create the VscodeModule with runtime dependencies
      const vscodeModule = VscodeModule.forRoot({
        context,
        vscodeApi: vscode,
        serverProcess,
        webviewProvider,
      });

      // Create the extension module as a dynamic module that imports VscodeModule
      const extensionModule: DynamicModule = {
        module: moduleClass,
        imports: [vscodeModule],
      };

      // Bootstrap NestJS application context
      log(`Bootstrapping NestJS application context...`);
      app = await NestFactory.createApplicationContext(extensionModule, {
        logger: ['error', 'warn'],
      });
      log(`NestJS application context created successfully`);

      // Register webview provider
      context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
          config.webviewViewType,
          webviewProvider,
        ),
      );

      // Get ExtensionMessageBus from NestJS container - this sets up the webview message handler
      // The ExtensionMessageBus constructor calls setupWebviewMessageHandler() which registers
      // with webviewProvider.onMessage() to handle all incoming webview messages
      try {
        const messageBus = app.get(ExtensionMessageBus);
        log(
          `ExtensionMessageBus initialized with ${messageBus.getRegisteredHandlers().length} handlers`,
        );
      } catch {
        // ExtensionMessageBus may not be available if webviewProvider wasn't provided
        log(
          `ExtensionMessageBus not available - webview messages will not be routed`,
        );
      }

      // Discover and register command handlers from NestJS container
      const commandRegistry = new CommandRegistry();

      for (const token of config.commandHandlerTokens) {
        try {
          const instance = app.get(token);
          commandRegistry.addProvider(instance);
          log(`Added command handler provider: ${token.name}`);
        } catch (error) {
          logError(
            `Failed to get command handler ${token.name}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      commandRegistry.registerAllToContext(context);
      log(`Registered commands: ${commandRegistry.getCommandIds().join(', ')}`);

      // Add cleanup to subscriptions
      context.subscriptions.push({
        dispose: async () => {
          if (app) {
            await app.close();
            app = null;
          }
        },
      });
    } catch (error) {
      logError(
        `Failed to activate extension: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (error instanceof Error && error.stack) {
        logError(error.stack);
      }
      throw error;
    }
  }

  function deactivate(): void {
    if (serverProcess) {
      serverProcess.stop();
      serverProcess = null;
    }
  }

  return { activate, deactivate };
}
