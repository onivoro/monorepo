import type { Disposable } from './disposable';
import type { JsonRpcError } from './jsonrpc-error';
import type { JsonRpcHandlerFn } from './jsonrpc-handler-fn';

/**
 * Options for sending a request via the MessageBus.
 */
export interface SendRequestOptions {
  /** Timeout in milliseconds. If not provided, uses implementation default. */
  timeoutMs?: number;
}

/**
 * Result of a request that may have failed.
 * Use this when you want to handle errors without throwing.
 */
export type RequestResult<T> =
  | { success: true; result: T }
  | { success: false; error: JsonRpcError };

/**
 * Handler registration options for incoming requests.
 */
export interface HandlerRegistrationOptions {
  /**
   * If true, replaces any existing handler for the same method.
   * If false (default), throws an error if a handler already exists.
   */
  overwrite?: boolean;
}

/**
 * Metadata about a registered handler.
 */
export interface HandlerInfo {
  /** The method name this handler responds to */
  method: string;
  /** Whether this handler was registered with overwrite option */
  canBeOverwritten: boolean;
}

/**
 * Event emitted when a notification is received.
 */
export interface NotificationEvent<TParams = unknown> {
  /** The notification method name */
  method: string;
  /** The notification parameters */
  params: TParams;
  /** Timestamp when the notification was received */
  receivedAt: Date;
}

/**
 * MessageBus provides a unified interface for JSON-RPC communication
 * across different transport layers (stdio, webview postMessage, etc.).
 *
 * This interface abstracts the underlying transport mechanism, allowing
 * the same code to work in browser, Node.js, and VSCode extension contexts.
 *
 * ## Message Flow Patterns
 *
 * ### Request-Response (bidirectional)
 * ```
 * Sender                              Receiver
 *   |--- sendRequest('method', {}) --->|
 *   |                                  | (handler processes)
 *   |<-------- Promise<result> --------|
 * ```
 *
 * ### Notification (fire-and-forget)
 * ```
 * Sender                              Receiver
 *   |--- sendNotification('event') --->|
 *   |                                  | (onNotification callback)
 *   | (no response expected)           |
 * ```
 *
 * ## Target Routing
 *
 * Methods can be prefixed with a target to control routing:
 * - `server.health` - Route to stdio server process
 * - `webview.update` - Route to browser/webview
 * - `extension.command` - Route to VSCode extension
 * - `broadcast.sync` - Route to all targets
 *
 * @example Basic usage
 * ```typescript
 * // Send a request and wait for response
 * const result = await messageBus.sendRequest<HealthParams, HealthResult>(
 *   'server.health',
 *   { includeMetrics: true }
 * );
 *
 * // Send a notification (no response expected)
 * messageBus.sendNotification('broadcast.user.loggedIn', { userId: '123' });
 *
 * // Listen for notifications
 * const unsubscribe = messageBus.onNotification<UserEvent>(
 *   'user.updated',
 *   (params) => console.log('User updated:', params)
 * );
 *
 * // Register a handler for incoming requests
 * messageBus.registerHandler<HealthParams, HealthResult>(
 *   'health',
 *   async (params) => ({ status: 'ok', timestamp: Date.now() })
 * );
 * ```
 */
export interface MessageBus {
  /**
   * Sends a JSON-RPC request and waits for the response.
   *
   * The method name can optionally be prefixed with a routing target:
   * - `server.methodName` - Route to server process
   * - `webview.methodName` - Route to webview
   * - `extension.methodName` - Route to extension host
   * - `broadcast.methodName` - Route to all (first response wins)
   *
   * @param method - The method name to invoke, optionally with target prefix
   * @param params - Optional parameters to send with the request
   * @param options - Optional configuration for the request
   * @returns Promise resolving to the result from the handler
   * @throws {JsonRpcError} If the remote handler returns an error
   * @throws {Error} If the request times out or transport fails
   *
   * @example
   * const health = await bus.sendRequest('server.health', { verbose: true });
   */
  sendRequest<TParams = unknown, TResult = unknown>(
    method: string,
    params?: TParams,
    options?: SendRequestOptions,
  ): Promise<TResult>;

  /**
   * Sends a JSON-RPC notification (fire-and-forget).
   *
   * Notifications do not expect a response. Use this for events,
   * progress updates, or any one-way communication.
   *
   * @param method - The notification method name, optionally with target prefix
   * @param params - Optional parameters to send with the notification
   *
   * @example
   * bus.sendNotification('broadcast.user.activity', { action: 'click', target: 'button' });
   */
  sendNotification<TParams = unknown>(method: string, params?: TParams): void;

  /**
   * Subscribes to incoming notifications for a specific method.
   *
   * Multiple handlers can be registered for the same notification method.
   * All matching handlers will be called when a notification is received.
   *
   * @param method - The notification method to listen for
   * @param handler - Callback function invoked when notification is received
   * @returns Disposable function to unsubscribe from the notification
   *
   * @example
   * const unsubscribe = bus.onNotification<ProgressParams>(
   *   'task.progress',
   *   (params) => updateProgressBar(params.percent)
   * );
   *
   * // Later, when done listening:
   * unsubscribe();
   */
  onNotification<TParams = unknown>(
    method: string,
    handler: (params: TParams) => void,
  ): Disposable;

  /**
   * Registers a handler for incoming JSON-RPC requests.
   *
   * Only one handler can be registered per method (unless overwrite is true).
   * The handler receives the request params and must return a Promise
   * with the result (or throw an error).
   *
   * @param method - The method name this handler responds to
   * @param handler - Async function that processes requests and returns results
   * @param options - Optional registration options
   * @returns Disposable function to unregister the handler
   * @throws {Error} If a handler already exists for this method (unless overwrite: true)
   *
   * @example
   * const unregister = bus.registerHandler<GetUserParams, User>(
   *   'user.get',
   *   async (params) => {
   *     const user = await db.findUser(params.id);
   *     if (!user) throw new Error('User not found');
   *     return user;
   *   }
   * );
   */
  registerHandler<TParams = unknown, TResult = unknown>(
    method: string,
    handler: JsonRpcHandlerFn<TParams, TResult>,
    options?: HandlerRegistrationOptions,
  ): Disposable;

  /**
   * Returns information about all registered handlers.
   *
   * Useful for debugging and introspection.
   *
   * @returns Array of handler metadata
   */
  getRegisteredHandlers(): HandlerInfo[];

  /**
   * Checks if a handler is registered for a specific method.
   *
   * @param method - The method name to check
   * @returns True if a handler is registered
   */
  hasHandler(method: string): boolean;

  /**
   * Disposes the message bus and cleans up all resources.
   *
   * After disposal:
   * - All notification subscriptions are removed
   * - All handlers are unregistered
   * - Pending requests are rejected
   * - The bus should not be used again
   */
  dispose(): void;
}

/**
 * Factory function type for creating MessageBus instances.
 * Different environments provide different factory implementations.
 */
export type MessageBusFactory<TConfig = unknown> = (
  config?: TConfig,
) => MessageBus;

/**
 * Symbol for dependency injection of MessageBus instances.
 * Use with NestJS or other DI containers.
 *
 * @example
 * // In a NestJS module
 * {
 *   provide: MESSAGE_BUS,
 *   useFactory: (transport) => createMessageBus(transport),
 *   inject: [TransportService],
 * }
 *
 * // In a service
 * constructor(@Inject(MESSAGE_BUS) private readonly messageBus: MessageBus) {}
 */
export const MESSAGE_BUS = Symbol('MESSAGE_BUS');
