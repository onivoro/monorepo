import { Module, DynamicModule, Provider, Type } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { MESSAGE_BUS } from '@onivoro/isomorphic-jsonrpc';
import { VscodeCommandsService } from './vscode-commands.service';
import { VscodeWorkspaceService } from './vscode-workspace.service';
import { ServerProcessService } from './server-process.service';
import { VscodeModuleOptions } from './vscode-module-options';
import {
  VSCODE_API,
  VSCODE_EXTENSION_CONTEXT,
  STDIO_SERVER_PROCESS,
  WEBVIEW_PROVIDER,
} from './vscode-injection-tokens';
import {
  ExtensionMessageBus,
  createExtensionMessageBus,
} from '../extension-message-bus';
import { WebviewHandlerRegistry } from '../webview-handler-registry';
import { ServerNotificationHandlerRegistry } from '../server-notification-handler-registry';

/**
 * NestJS module that bridges VSCode APIs into injectable services.
 *
 * This module provides:
 * - `VscodeCommandsService` - Wraps vscode.commands API
 * - `VscodeWorkspaceService` - Wraps vscode.workspace API
 * - `ServerProcessService` - Provides access to the stdio server process
 *
 * It also injects:
 * - `VSCODE_EXTENSION_CONTEXT` - The VSCode ExtensionContext
 * - `VSCODE_API` - The VSCode API module (use for window, languages, etc.)
 * - `STDIO_SERVER_PROCESS` - The StdioServerProcess instance
 * - `WEBVIEW_PROVIDER` - The webview provider instance (if provided)
 *
 * @example
 * ```typescript
 * // In your extension-side module
 * @Module({
 *   imports: [
 *     VscodeModule.forRoot({
 *       context: extensionContext,
 *       vscodeApi: vscode,
 *       serverProcess,
 *       webviewProvider,
 *     }),
 *   ],
 *   providers: [MyCommandService],
 * })
 * export class ExtensionModule {}
 * ```
 */
@Module({})
export class VscodeModule {
  /**
   * Configure the VscodeModule with runtime dependencies.
   *
   * @param options - Configuration options including VSCode context and server process
   * @param additionalProviders - Additional providers to include in the module
   */
  static forRoot(
    options: VscodeModuleOptions,
    additionalProviders: Array<Provider | Type> = [],
  ): DynamicModule {
    // Use useFactory instead of useValue to prevent NestJS from trying to
    // stringify these complex objects during module token generation.
    // The VSCode API object contains getters that throw errors when accessed
    // (like extensionRuntime), which causes issues with fast-safe-stringify.
    const providers: Provider[] = [
      // Core VSCode dependencies - use factories to avoid serialization issues
      {
        provide: VSCODE_EXTENSION_CONTEXT,
        useFactory: () => options.context,
      },
      {
        provide: VSCODE_API,
        useFactory: () => options.vscodeApi,
      },
      {
        provide: STDIO_SERVER_PROCESS,
        useFactory: () => options.serverProcess,
      },

      // VSCode API wrapper services
      VscodeCommandsService,
      VscodeWorkspaceService,

      // Server process service
      ServerProcessService,

      // ServerNotificationHandlerRegistry discovers @ServerNotificationHandler decorated methods
      ServerNotificationHandlerRegistry,
    ];

    // Optionally add webview provider and ExtensionMessageBus
    if (options.webviewProvider) {
      providers.push(
        {
          provide: WEBVIEW_PROVIDER,
          useFactory: () => options.webviewProvider,
        },
        // WebviewHandlerRegistry discovers @WebviewHandler decorated methods
        WebviewHandlerRegistry,
        // ExtensionMessageBus requires both serverProcess and webviewProvider
        {
          provide: ExtensionMessageBus,
          useFactory: (registry: WebviewHandlerRegistry) =>
            createExtensionMessageBus(
              options.serverProcess,
              options.webviewProvider!,
              registry,
            ),
          inject: [WebviewHandlerRegistry],
        },
        {
          provide: MESSAGE_BUS,
          useExisting: ExtensionMessageBus,
        },
      );
    }

    return {
      module: VscodeModule,
      imports: [DiscoveryModule],
      providers: [...providers, ...additionalProviders],
      exports: [
        VSCODE_EXTENSION_CONTEXT,
        VSCODE_API,
        STDIO_SERVER_PROCESS,
        WEBVIEW_PROVIDER,
        VscodeCommandsService,
        VscodeWorkspaceService,
        ServerProcessService,
        ServerNotificationHandlerRegistry,
        WebviewHandlerRegistry,
        ExtensionMessageBus,
        MESSAGE_BUS,
        ...additionalProviders,
      ],
      global: true,
    };
  }
}
