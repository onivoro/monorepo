import {
  Injectable,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Inject,
  Optional,
} from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { StdioServerProcess } from '@onivoro/server-stdio';
import { JsonRpcNotification, JSONRPC_VERSION } from '@onivoro/isomorphic-jsonrpc';
import {
  STDIO_SERVER_PROCESS,
  WEBVIEW_PROVIDER,
} from './vscode-module/vscode-injection-tokens';
import { BaseWebviewProvider } from './classes/base-webview-provider';
import {
  SERVER_NOTIFICATION_HANDLER_METADATA,
  ServerNotificationHandlerMetadata,
} from './decorators/server-notification-handler.decorator';

/**
 * Notification handler function type.
 */
export type NotificationHandlerFn<TParams = unknown> = (
  params: TParams,
) => void | Promise<void>;

/**
 * Registry that discovers and manages @ServerNotificationHandler decorated methods.
 *
 * This service scans all providers in the application for methods decorated
 * with @ServerNotificationHandler and registers them to receive notifications
 * from the stdio server process.
 *
 * @example
 * ```typescript
 * // In your extension module
 * @Module({
 *   providers: [
 *     ServerNotificationHandlerRegistry,
 *     MyServerNotificationService, // Contains @ServerNotificationHandler methods
 *   ],
 * })
 * export class ExtensionModule {}
 * ```
 */
@Injectable()
export class ServerNotificationHandlerRegistry
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly handlers: Map<string, NotificationHandlerFn> = new Map();
  private readonly unsubscribers: (() => void)[] = [];

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    @Inject(STDIO_SERVER_PROCESS)
    private readonly serverProcess: StdioServerProcess,
    @Optional()
    @Inject(WEBVIEW_PROVIDER)
    private readonly webviewProvider: BaseWebviewProvider | null = null,
  ) {}

  /**
   * Called after all modules are initialized. Discovers and registers all handlers.
   * Uses OnApplicationBootstrap instead of OnModuleInit to ensure all providers
   * from all modules (including app modules that import VscodeModule) are available.
   */
  onApplicationBootstrap(): void {
    this.discoverHandlers();
    this.subscribeToServerNotifications();
  }

  /**
   * Cleanup subscriptions on module destroy.
   */
  onModuleDestroy(): void {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers.length = 0;
    this.handlers.clear();
  }

  /**
   * Get the handler for a specific method.
   *
   * @param method - The method name to look up
   * @returns The handler function, or undefined if none
   */
  getHandler(method: string): NotificationHandlerFn | undefined {
    return this.handlers.get(method);
  }

  /**
   * Check if a handler is registered for a method.
   *
   * @param method - The method name to check
   * @returns True if a handler exists
   */
  hasHandler(method: string): boolean {
    return this.handlers.has(method);
  }

  /**
   * Get all registered method names.
   *
   * @returns Array of registered method names
   */
  getRegisteredMethods(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Manually register a handler for a method.
   *
   * @param method - The method name
   * @param handler - The handler function
   * @throws Error if a handler is already registered for this method
   */
  registerHandler(method: string, handler: NotificationHandlerFn): void {
    if (this.handlers.has(method)) {
      throw new Error(
        `[ServerNotificationHandlerRegistry] Duplicate handler for method "${method}". ` +
          `Each method can only have one handler.`,
      );
    }
    this.handlers.set(method, handler);
    console.log(
      `[ServerNotificationHandlerRegistry] Registered handler: ${method}`,
    );
  }

  /**
   * Discover all providers with @ServerNotificationHandler decorated methods and register them.
   */
  private discoverHandlers(): void {
    const providers = this.discoveryService.getProviders();

    for (const wrapper of providers) {
      const { instance } = wrapper;
      if (!instance || typeof instance !== 'object') {
        continue;
      }

      const prototype = Object.getPrototypeOf(instance);
      if (!prototype) {
        continue;
      }

      // Scan all methods on the prototype
      this.metadataScanner.scanFromPrototype(
        instance,
        prototype,
        (methodName: string) => {
          const methodRef = prototype[methodName];
          const metadata: ServerNotificationHandlerMetadata | undefined =
            Reflect.getMetadata(
              SERVER_NOTIFICATION_HANDLER_METADATA,
              methodRef,
            );

          if (metadata) {
            const handler = (instance as Record<string, unknown>)[methodName];
            if (typeof handler === 'function') {
              if (this.handlers.has(metadata.method)) {
                throw new Error(
                  `[ServerNotificationHandlerRegistry] Duplicate handler for method "${metadata.method}". ` +
                    `Each method can only have one handler. ` +
                    `Found duplicate in ${wrapper.name ?? 'unknown'}.${methodName}`,
                );
              }
              this.handlers.set(metadata.method, handler.bind(instance));
            }
          }
        },
      );
    }

    const methods = this.getRegisteredMethods();
    console.log(
      `[ServerNotificationHandlerRegistry] Discovered ${methods.length} handlers: ${methods.join(', ')}`,
    );
  }

  /**
   * Subscribe to server notifications and dispatch to registered handlers.
   * Also broadcasts to webview (implicit broadcast with sender exclusion).
   */
  private subscribeToServerNotifications(): void {
    for (const method of this.handlers.keys()) {
      const unsubscribe = this.serverProcess.onNotification(
        method,
        async (params: unknown) => {
          // Dispatch to extension handler
          const handler = this.handlers.get(method);
          if (handler) {
            try {
              await handler(params);
            } catch (error) {
              console.error(
                `[ServerNotificationHandlerRegistry] Error in handler for "${method}":`,
                error,
              );
            }
          }

          // Broadcast to webview (sender exclusion: skip server)
          this.forwardToWebview(method, params);
        },
      );
      this.unsubscribers.push(unsubscribe);
    }
  }

  /**
   * Forward a notification to the webview.
   */
  private forwardToWebview(method: string, params: unknown): void {
    if (!this.webviewProvider) return;

    const notification: JsonRpcNotification = {
      jsonrpc: JSONRPC_VERSION,
      method,
      params,
    };

    this.webviewProvider.postMessage(notification);
  }
}
