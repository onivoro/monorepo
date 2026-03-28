import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { JsonRpcHandlerFn } from '@onivoro/isomorphic-jsonrpc';
import {
  WEBVIEW_HANDLER_METADATA,
  WebviewHandlerMetadata,
} from './decorators/webview-handler.decorator';

/**
 * Registry that discovers and manages @WebviewHandler decorated methods.
 *
 * This service scans all providers in the application for methods decorated
 * with @WebviewHandler and registers them for routing webview messages.
 *
 * @example
 * ```typescript
 * // In your extension module
 * @Module({
 *   providers: [
 *     WebviewHandlerRegistry,
 *     MyWebviewHandlerService, // Contains @WebviewHandler methods
 *   ],
 * })
 * export class ExtensionModule {}
 *
 * // Access the registry to route messages
 * const handler = registry.getHandler('extension.selectFile');
 * if (handler) {
 *   const result = await handler(params);
 * }
 * ```
 */
@Injectable()
export class WebviewHandlerRegistry implements OnApplicationBootstrap {
  private readonly handlers: Map<string, JsonRpcHandlerFn> = new Map();

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
  ) {}

  /**
   * Called after all modules are initialized. Discovers and registers all handlers.
   * Uses OnApplicationBootstrap instead of OnModuleInit to ensure all providers
   * from all modules (including app modules that import VscodeModule) are available.
   */
  onApplicationBootstrap(): void {
    this.discoverHandlers();
  }

  /**
   * Get a handler for a specific method.
   *
   * @param method - The method name to look up
   * @returns The handler function, or undefined if not found
   */
  getHandler(method: string): JsonRpcHandlerFn | undefined {
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
  registerHandler(method: string, handler: JsonRpcHandlerFn): void {
    if (this.handlers.has(method)) {
      throw new Error(
        `[WebviewHandlerRegistry] Duplicate handler for method "${method}". ` +
          `Each method can only have one handler.`,
      );
    }
    this.handlers.set(method, handler);
    console.log(`[WebviewHandlerRegistry] Registered handler: ${method}`);
  }

  /**
   * Discover all providers with @WebviewHandler decorated methods and register them.
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
          const metadata: WebviewHandlerMetadata | undefined =
            Reflect.getMetadata(WEBVIEW_HANDLER_METADATA, methodRef);

          if (metadata) {
            const handler = (instance as Record<string, unknown>)[methodName];
            if (typeof handler === 'function') {
              if (this.handlers.has(metadata.method)) {
                throw new Error(
                  `[WebviewHandlerRegistry] Duplicate handler for method "${metadata.method}". ` +
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
      `[WebviewHandlerRegistry] Discovered ${methods.length} handlers: ${methods.join(', ')}`,
    );
  }
}
