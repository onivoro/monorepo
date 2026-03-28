import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ModuleRef, DiscoveryService, MetadataScanner } from '@nestjs/core';
import { JsonRpcNotification, JSONRPC_VERSION } from '@onivoro/isomorphic-jsonrpc';
import { StdioTransport } from './stdio-transport';
import { STDIO_HANDLER_METADATA, StdioHandlerMetadata } from './stdio-handler';

/**
 * Service that manages the StdioTransport lifecycle and handler discovery.
 */
@Injectable()
export class StdioTransportService implements OnModuleInit, OnModuleDestroy {
  private readonly transport: StdioTransport;

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
  ) {
    this.transport = new StdioTransport();
  }

  /**
   * Called when the module initializes. Discovers and registers all handlers.
   */
  onModuleInit(): void {
    this.discoverAndRegisterHandlers();
  }

  /**
   * Called when the module is destroyed. Closes the transport.
   */
  onModuleDestroy(): void {
    this.transport.close();
  }

  /**
   * Get the underlying StdioTransport instance.
   */
  getTransport(): StdioTransport {
    return this.transport;
  }

  /**
   * Manually register a handler for a method.
   */
  registerHandler<TParams = unknown, TResult = unknown>(
    method: string,
    handler: (params: TParams) => Promise<TResult>,
  ): void {
    this.transport.on(method, handler);
  }

  /**
   * Send a notification to the extension (no response expected).
   *
   * Use this to push events from the server to the extension.
   * Notifications are JSON-RPC 2.0 compliant (method + params, no id).
   *
   * @param method - The method/event name
   * @param params - Optional parameters
   *
   * @example
   * ```typescript
   * // In a NestJS service
   * @Injectable()
   * class MyService {
   *   constructor(private readonly stdioTransport: StdioTransportService) {}
   *
   *   notifyFileChanged(filePath: string) {
   *     this.stdioTransport.sendNotification('file.changed', { path: filePath });
   *   }
   * }
   * ```
   */
  sendNotification<T = unknown>(method: string, params?: T): void {
    const message: JsonRpcNotification<T> = {
      jsonrpc: JSONRPC_VERSION,
      method,
      params,
    };
    process.stdout.write(JSON.stringify(message) + '\n');
  }

  /**
   * Discover all providers with @StdioHandler decorated methods and register them.
   */
  private discoverAndRegisterHandlers(): void {
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
          const metadata: StdioHandlerMetadata | undefined =
            Reflect.getMetadata(STDIO_HANDLER_METADATA, methodRef);

          if (metadata) {
            const handler = (instance as Record<string, unknown>)[methodName];
            if (typeof handler === 'function') {
              this.transport.on(metadata.method, handler.bind(instance));
            }
          }
        },
      );
    }

    const methods = this.transport.getRegisteredMethods();
    console.log(
      `[StdioTransport] Registered ${methods.length} handlers: ${methods.join(', ')}`,
    );
  }
}
