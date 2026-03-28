import { Injectable, OnModuleDestroy } from '@nestjs/common';
import {
  MessageBus,
  Disposable,
  JsonRpcHandlerFn,
  JsonRpcNotification,
  JSONRPC_VERSION,
  SendRequestOptions,
  HandlerRegistrationOptions,
  HandlerInfo,
} from '@onivoro/isomorphic-jsonrpc';
import { StdioTransportService } from './stdio-transport-service';

/**
 * Configuration for the StdioMessageBus.
 */
export interface StdioMessageBusConfig {
  /** Custom timeout for requests in milliseconds. Default: 30000 */
  requestTimeoutMs?: number;
}

/**
 * MessageBus implementation for stdio server environment.
 *
 * This implementation wraps the StdioTransportService to provide
 * the unified MessageBus interface for server-side code.
 *
 * ## Capabilities
 *
 * ### Handler Registration
 * Handlers registered via `registerHandler()` receive incoming JSON-RPC
 * requests from the extension host and return responses.
 *
 * ### Notifications
 * Use `sendNotification()` to push events to the extension host.
 * The server cannot initiate requests to the extension (one-way).
 *
 * ### No Request Sending
 * The stdio server cannot send requests and wait for responses.
 * `sendRequest()` will throw an error. Use notifications instead.
 *
 * @example
 * ```typescript
 * @Injectable()
 * class MyService {
 *   constructor(private readonly messageBus: StdioMessageBus) {}
 *
 *   onModuleInit() {
 *     // Register a handler
 *     this.messageBus.registerHandler('getData', async (params) => {
 *       return { data: await this.fetchData(params.id) };
 *     });
 *
 *     // Send notification to extension
 *     this.messageBus.sendNotification('extension.ready', { version: '1.0' });
 *   }
 * }
 * ```
 */
@Injectable()
export class StdioMessageBus implements MessageBus, OnModuleDestroy {
  private readonly config: Required<StdioMessageBusConfig>;
  private readonly notificationHandlers: Map<
    string,
    Set<(params: unknown) => void>
  > = new Map();
  private readonly registeredMethods: Map<string, HandlerRegistrationOptions> =
    new Map();
  private disposed = false;

  constructor(
    private readonly transportService: StdioTransportService,
    config: StdioMessageBusConfig = {},
  ) {
    this.config = {
      requestTimeoutMs: config.requestTimeoutMs ?? 30000,
    };
  }

  /**
   * Not supported in stdio server environment.
   *
   * The stdio server can only respond to requests, not initiate them.
   * Use `sendNotification()` for one-way messages to the extension.
   *
   * @throws {Error} Always throws - not supported
   */
  sendRequest<TParams = unknown, TResult = unknown>(
    method: string,
    _params?: TParams,
    _options?: SendRequestOptions,
  ): Promise<TResult> {
    throw new Error(
      `sendRequest() is not supported in stdio server environment. ` +
        `The server can only respond to requests from the extension. ` +
        `Use sendNotification() for one-way messages. Method: ${method}`,
    );
  }

  /**
   * Sends a JSON-RPC notification to the extension (fire-and-forget).
   *
   * Notifications are written to stdout and received by the extension's
   * StdioServerProcess which dispatches them to registered listeners.
   *
   * @example
   * ```typescript
   * // Notify extension of progress
   * messageBus.sendNotification('extension.taskProgress', {
   *   taskId: 'task-123',
   *   progress: 50,
   * });
   * ```
   */
  sendNotification<TParams = unknown>(method: string, params?: TParams): void {
    this.ensureNotDisposed();
    this.transportService.sendNotification(method, params);
  }

  /**
   * Subscribes to incoming notifications.
   *
   * Note: In the stdio server, notifications come from the extension.
   * However, the current protocol primarily uses request/response.
   * This method is provided for future compatibility.
   */
  onNotification<TParams = unknown>(
    method: string,
    handler: (params: TParams) => void,
  ): Disposable {
    this.ensureNotDisposed();

    if (!this.notificationHandlers.has(method)) {
      this.notificationHandlers.set(method, new Set());
    }

    const handlers = this.notificationHandlers.get(method)!;
    handlers.add(handler as (params: unknown) => void);

    return () => {
      handlers.delete(handler as (params: unknown) => void);
      if (handlers.size === 0) {
        this.notificationHandlers.delete(method);
      }
    };
  }

  /**
   * Registers a handler for incoming JSON-RPC requests.
   *
   * This is the primary way the stdio server handles requests from
   * the extension. Each method can only have one handler.
   *
   * @example
   * ```typescript
   * messageBus.registerHandler('user.get', async (params: { id: string }) => {
   *   const user = await db.findUser(params.id);
   *   return { user };
   * });
   * ```
   */
  registerHandler<TParams = unknown, TResult = unknown>(
    method: string,
    handler: JsonRpcHandlerFn<TParams, TResult>,
    options?: HandlerRegistrationOptions,
  ): Disposable {
    this.ensureNotDisposed();

    const transport = this.transportService.getTransport();

    if (transport.hasHandler(method) && !options?.overwrite) {
      throw new Error(`Handler already registered for method: ${method}`);
    }

    if (transport.hasHandler(method) && options?.overwrite) {
      transport.removeHandler(method);
    }

    transport.on(method, handler);
    this.registeredMethods.set(method, options ?? {});

    console.log(`[StdioMessageBus] Registered handler: ${method}`);

    return () => {
      transport.removeHandler(method);
      this.registeredMethods.delete(method);
      console.log(`[StdioMessageBus] Unregistered handler: ${method}`);
    };
  }

  /**
   * Returns information about all registered handlers.
   */
  getRegisteredHandlers(): HandlerInfo[] {
    const transport = this.transportService.getTransport();
    const methods = transport.getRegisteredMethods();

    return methods.map((method) => ({
      method,
      canBeOverwritten: this.registeredMethods.get(method)?.overwrite ?? false,
    }));
  }

  /**
   * Checks if a handler is registered for a specific method.
   */
  hasHandler(method: string): boolean {
    return this.transportService.getTransport().hasHandler(method);
  }

  /**
   * Disposes the message bus and cleans up all resources.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.notificationHandlers.clear();
    this.registeredMethods.clear();
  }

  /**
   * NestJS lifecycle hook - cleans up on module destroy.
   */
  onModuleDestroy(): void {
    this.dispose();
  }

  /**
   * Ensure the bus hasn't been disposed.
   */
  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('MessageBus has been disposed');
    }
  }
}

/**
 * Factory function to create a StdioMessageBus.
 *
 * @example
 * ```typescript
 * // In a NestJS module
 * {
 *   provide: MESSAGE_BUS,
 *   useFactory: (transport: StdioTransportService) =>
 *     createStdioMessageBus(transport),
 *   inject: [StdioTransportService],
 * }
 * ```
 */
export function createStdioMessageBus(
  transportService: StdioTransportService,
  config?: StdioMessageBusConfig,
): StdioMessageBus {
  return new StdioMessageBus(transportService, config);
}
