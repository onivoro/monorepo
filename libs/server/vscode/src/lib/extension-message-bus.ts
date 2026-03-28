import { Injectable, Inject, OnModuleDestroy, Optional } from '@nestjs/common';
import {
  MessageBus,
  Disposable,
  JsonRpcHandlerFn,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  JSONRPC_VERSION,
  SendRequestOptions,
  HandlerRegistrationOptions,
  HandlerInfo,
  parseMethodTarget,
  MessageTarget,
  shouldRouteToTarget,
} from '@onivoro/isomorphic-jsonrpc';
import { StdioServerProcess } from '@onivoro/server-stdio';
import {
  STDIO_SERVER_PROCESS,
  WEBVIEW_PROVIDER,
} from './vscode-module/vscode-injection-tokens';
import { BaseWebviewProvider } from './classes/base-webview-provider';
import { WebviewHandlerRegistry } from './webview-handler-registry';

/**
 * Configuration for the ExtensionMessageBus.
 */
export interface ExtensionMessageBusConfig {
  /** Custom timeout for requests in milliseconds. Default: 30000 */
  requestTimeoutMs?: number;
  /** Enable debug logging. Default: false */
  debug?: boolean;
}

/**
 * The origin of a message for routing purposes.
 */
type MessageOrigin = 'webview' | 'server' | 'extension';

/**
 * MessageBus implementation for VSCode extension environment.
 *
 * This implementation acts as a **hub** that broadcasts messages to all
 * targets except the sender (implicit broadcast with sender exclusion).
 *
 * ## Routing Strategy
 *
 * Messages are automatically routed to find a handler:
 * - From webview → tries server, then extension (skips webview)
 * - From server → tries extension, then webview (skips server)
 * - From extension → tries server, then webview (skips extension)
 *
 * The first target that has a handler responds. No prefixes needed.
 *
 * ## Message Flow
 *
 * ### Webview → Extension/Server
 * Webview sends request, extension tries to handle locally first,
 * then forwards to server if no local handler exists.
 *
 * ### Server → Extension/Webview
 * Server sends notification, extension handles locally and/or
 * forwards to webview.
 *
 * @example
 * ```typescript
 * // From webview - no prefix needed, finds handler automatically
 * const result = await messageBus.sendRequest('showInputBox', { prompt: 'Enter value' });
 *
 * // From server - notification broadcasts to extension and webview
 * messageBus.sendNotification('taskProgress', { progress: 50 });
 * ```
 */
@Injectable()
export class ExtensionMessageBus implements MessageBus, OnModuleDestroy {
  private readonly resolvedConfig: Required<ExtensionMessageBusConfig>;
  private readonly notificationHandlers: Map<
    string,
    Set<(params: unknown) => void>
  > = new Map();
  private readonly requestHandlers: Map<string, JsonRpcHandlerFn> = new Map();
  private readonly handlerOptions: Map<string, HandlerRegistrationOptions> =
    new Map();
  private readonly serverNotificationUnsubscribes: (() => void)[] = [];
  private readonly pendingWebviewRequests: Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timeoutId: ReturnType<typeof setTimeout>;
    }
  > = new Map();
  private webviewRequestIdCounter = 0;
  private disposed = false;

  constructor(
    @Inject(STDIO_SERVER_PROCESS)
    private readonly serverProcess: StdioServerProcess,
    @Inject(WEBVIEW_PROVIDER)
    private readonly webviewProvider: BaseWebviewProvider,
    @Optional()
    private readonly webviewHandlerRegistry: WebviewHandlerRegistry | null = null,
    config: ExtensionMessageBusConfig = {},
  ) {
    this.resolvedConfig = {
      requestTimeoutMs: config.requestTimeoutMs ?? 30000,
      debug: config.debug ?? false,
    };

    this.setupWebviewMessageHandler();
  }

  /**
   * Sends a JSON-RPC request and waits for the response.
   *
   * When called from the extension, routes to server first, then webview.
   * Prefix-based routing is still supported for explicit targeting:
   * - `server.*` → Route to stdio server only
   * - `webview.*` → Route to webview only
   * - `extension.*` → Handle locally only
   * - No prefix → Implicit broadcast (server → webview)
   */
  async sendRequest<TParams = unknown, TResult = unknown>(
    method: string,
    params?: TParams,
    options?: SendRequestOptions,
  ): Promise<TResult> {
    this.ensureNotDisposed();

    const { target, method: actualMethod } = parseMethodTarget(method);
    const timeoutMs =
      options?.timeoutMs ?? this.resolvedConfig.requestTimeoutMs;

    this.log(
      `sendRequest: ${method} -> target=${target}, method=${actualMethod}`,
    );

    // Explicit targeting via prefix
    if (target === MessageTarget.WEBVIEW) {
      return this.sendWebviewRequest<TParams, TResult>(
        actualMethod,
        params,
        timeoutMs,
      );
    }

    if (target === MessageTarget.EXTENSION) {
      return this.handleLocalRequest<TParams, TResult>(actualMethod, params);
    }

    if (target === MessageTarget.SERVER) {
      return this.serverProcess.sendRequest<TResult>(
        actualMethod,
        params,
        timeoutMs,
      );
    }

    // No prefix or broadcast: use implicit routing from extension
    // Extension → server first, then webview
    return this.routeRequest<TParams, TResult>(
      actualMethod,
      params,
      'extension',
    );
  }

  /**
   * Sends a JSON-RPC notification (fire-and-forget).
   *
   * When called from the extension, broadcasts to server and webview.
   * Prefix-based routing is still supported for explicit targeting:
   * - `server.*` → Send to server only
   * - `webview.*` → Send to webview only
   * - `extension.*` → Dispatch to local handlers only
   * - `broadcast.*` → Send to all targets explicitly
   * - No prefix → Implicit broadcast (server + webview, excluding self)
   */
  sendNotification<TParams = unknown>(method: string, params?: TParams): void {
    this.ensureNotDisposed();

    const { target, method: actualMethod } = parseMethodTarget(method);

    this.log(
      `sendNotification: ${method} -> target=${target}, method=${actualMethod}`,
    );

    const notification: JsonRpcNotification<TParams> = {
      jsonrpc: JSONRPC_VERSION,
      method: actualMethod,
      params,
    };

    // Explicit targeting via prefix
    if (target !== null) {
      const targets: string[] = [];
      if (shouldRouteToTarget(method, MessageTarget.SERVER)) {
        targets.push('server');
        this.serverProcess
          .sendRequest(actualMethod, params)
          .catch((err) =>
            this.log(`Server notification error: ${err.message}`),
          );
      }

      if (shouldRouteToTarget(method, MessageTarget.WEBVIEW)) {
        targets.push('webview');
        this.webviewProvider.postMessage(notification);
      }

      if (shouldRouteToTarget(method, MessageTarget.EXTENSION)) {
        targets.push('extension');
        this.dispatchLocalNotification(actualMethod, params);
      }
      this.log(`sendNotification: "${actualMethod}" -> sent to [${targets.join(', ')}]`);
      return;
    }

    // No prefix: implicit broadcast from extension → server + webview
    this.serverProcess
      .sendRequest(actualMethod, params)
      .catch((err) => this.log(`Server notification error: ${err.message}`));
    this.webviewProvider.postMessage(notification);
    this.log(`sendNotification: "${actualMethod}" -> broadcast to [server, webview]`);
  }

  /**
   * Subscribes to incoming notifications.
   *
   * Notifications can come from:
   * - The stdio server process
   * - The webview
   * - Local dispatch via sendNotification
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

    // Also register with the server process for server-initiated notifications
    const serverUnsubscribe = this.serverProcess.onNotification(
      method,
      handler,
    );
    this.serverNotificationUnsubscribes.push(serverUnsubscribe);

    return () => {
      handlers.delete(handler as (params: unknown) => void);
      if (handlers.size === 0) {
        this.notificationHandlers.delete(method);
      }
      serverUnsubscribe();
    };
  }

  /**
   * Registers a handler for incoming JSON-RPC requests.
   *
   * Handlers are used for:
   * - Requests with `extension.*` prefix
   * - Requests from the webview that need extension handling
   */
  registerHandler<TParams = unknown, TResult = unknown>(
    method: string,
    handler: JsonRpcHandlerFn<TParams, TResult>,
    options?: HandlerRegistrationOptions,
  ): Disposable {
    this.ensureNotDisposed();

    if (this.requestHandlers.has(method) && !options?.overwrite) {
      throw new Error(`Handler already registered for method: ${method}`);
    }

    this.requestHandlers.set(method, handler as JsonRpcHandlerFn);
    this.handlerOptions.set(method, options ?? {});

    this.log(`Registered handler: ${method}`);

    return () => {
      this.requestHandlers.delete(method);
      this.handlerOptions.delete(method);
      this.log(`Unregistered handler: ${method}`);
    };
  }

  /**
   * Returns information about all registered handlers.
   * Includes both manually registered handlers and @WebviewHandler decorated methods.
   */
  getRegisteredHandlers(): HandlerInfo[] {
    const handlers: HandlerInfo[] = Array.from(this.requestHandlers.keys()).map(
      (method) => ({
        method,
        canBeOverwritten: this.handlerOptions.get(method)?.overwrite ?? false,
      }),
    );

    // Add handlers from WebviewHandlerRegistry
    if (this.webviewHandlerRegistry) {
      for (const method of this.webviewHandlerRegistry.getRegisteredMethods()) {
        // Don't duplicate if already in manual handlers
        if (!this.requestHandlers.has(method)) {
          handlers.push({ method, canBeOverwritten: false });
        }
      }
    }

    return handlers;
  }

  /**
   * Checks if a handler is registered for a specific method.
   * Checks both manually registered handlers and @WebviewHandler decorated methods.
   */
  hasHandler(method: string): boolean {
    return (
      this.requestHandlers.has(method) ||
      (this.webviewHandlerRegistry?.hasHandler(method) ?? false)
    );
  }

  /**
   * Disposes the message bus and cleans up all resources.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // Cancel all pending webview requests
    for (const [, pending] of this.pendingWebviewRequests) {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error('MessageBus disposed'));
    }
    this.pendingWebviewRequests.clear();

    // Unsubscribe from server notifications
    for (const unsubscribe of this.serverNotificationUnsubscribes) {
      unsubscribe();
    }
    this.serverNotificationUnsubscribes.length = 0;

    // Clear handlers
    this.notificationHandlers.clear();
    this.requestHandlers.clear();
    this.handlerOptions.clear();
  }

  /**
   * NestJS lifecycle hook - cleans up on module destroy.
   */
  onModuleDestroy(): void {
    this.dispose();
  }

  /**
   * Handle a message from the webview.
   *
   * Broadcasts to all targets except the sender (webview):
   * 1. Try extension handlers first
   * 2. If no extension handler, try server
   *
   * Returns the first successful result back to the webview.
   */
  async handleWebviewMessage(message: JsonRpcRequest): Promise<void> {
    this.log(`Webview message: ${message.method}`);

    // Check if this is a response to a pending webview request
    if ('result' in message || 'error' in message) {
      this.handleWebviewResponse(message as unknown as JsonRpcResponse);
      return;
    }

    const method = message.method;
    let result: unknown;
    let error: JsonRpcResponse['error'] | undefined;

    try {
      // Broadcast excluding webview: try extension first, then server
      result = await this.routeRequest(method, message.params, 'webview');
      this.log(`handleWebviewMessage: "${method}" -> routed successfully`);
    } catch (err) {
      this.log(`handleWebviewMessage: "${method}" -> routing failed: ${err instanceof Error ? err.message : String(err)}`);
      console.error(
        '[ExtensionMessageBus] Error handling webview message:',
        err,
      );
      error = {
        code: -32603,
        message:
          err instanceof Error ? err.message : String(err) || 'Unknown error',
      };
    }

    // Send response back to webview
    const response: JsonRpcResponse = {
      jsonrpc: JSONRPC_VERSION,
      id: message.id,
      ...(error ? { error } : { result }),
    };

    this.webviewProvider.postMessage(response);
  }

  /**
   * Route a request to available handlers, excluding the origin.
   *
   * Order of priority:
   * - From webview: extension → server
   * - From server: extension → webview
   * - From extension: server → webview
   */
  private async routeRequest<TParams, TResult>(
    method: string,
    params: TParams | undefined,
    excludeOrigin: MessageOrigin,
  ): Promise<TResult> {
    const targets: MessageOrigin[] = [];

    // Build target list based on origin
    switch (excludeOrigin) {
      case 'webview':
        // From webview: try extension first, then server
        targets.push('extension', 'server');
        break;
      case 'server':
        // From server: try extension first, then webview
        targets.push('extension', 'webview');
        break;
      case 'extension':
        // From extension: try server first, then webview
        targets.push('server', 'webview');
        break;
    }

    this.log(
      `routeRequest: method="${method}" origin=${excludeOrigin} targets=[${targets.join(', ')}]`,
    );

    // Try each target in order
    for (const target of targets) {
      if (target === 'extension' && this.hasHandler(method)) {
        this.log(`routeRequest: "${method}" -> matched extension handler`);
        return this.handleLocalRequest<TParams, TResult>(method, params);
      }

      if (target === 'extension') {
        this.log(`routeRequest: "${method}" -> no extension handler, skipping`);
      }

      if (target === 'server') {
        this.log(`routeRequest: "${method}" -> forwarding to server`);
        return this.serverProcess.sendRequest<TResult>(method, params);
      }

      if (target === 'webview') {
        this.log(`routeRequest: "${method}" -> forwarding to webview`);
        return this.sendWebviewRequest<TParams, TResult>(
          method,
          params,
          this.resolvedConfig.requestTimeoutMs,
        );
      }
    }

    this.log(`routeRequest: "${method}" -> no handler found in any target`);
    throw new Error(`No handler found for method: ${method}`);
  }

  /**
   * Set up the webview message handler.
   */
  private setupWebviewMessageHandler(): void {
    this.webviewProvider.onMessage((message: unknown) => {
      if (this.isJsonRpcRequest(message)) {
        this.handleWebviewMessage(message as JsonRpcRequest);
      } else {
        this.log('Message is not a valid JSON-RPC request');
      }
    });
  }

  /**
   * Send a request to the webview and wait for response.
   */
  private sendWebviewRequest<TParams, TResult>(
    method: string,
    params: TParams | undefined,
    timeoutMs: number,
  ): Promise<TResult> {
    return new Promise((resolve, reject) => {
      const id = this.generateWebviewRequestId();

      const timeoutId = setTimeout(() => {
        this.pendingWebviewRequests.delete(id);
        reject(
          new Error(`Webview request timeout after ${timeoutMs}ms: ${method}`),
        );
      }, timeoutMs);

      this.pendingWebviewRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeoutId,
      });

      const request: JsonRpcRequest<TParams> = {
        jsonrpc: JSONRPC_VERSION,
        id,
        method,
        params,
      };

      this.webviewProvider.postMessage(request);
    });
  }

  /**
   * Handle a response from the webview.
   */
  private handleWebviewResponse(response: JsonRpcResponse): void {
    const id = String(response.id);
    const pending = this.pendingWebviewRequests.get(id);

    if (!pending) return;

    clearTimeout(pending.timeoutId);
    this.pendingWebviewRequests.delete(id);

    if (response.error) {
      pending.reject(new Error(response.error.message || 'Unknown error'));
    } else {
      pending.resolve(response.result);
    }
  }

  /**
   * Handle a request locally using registered handlers.
   *
   * Checks handlers in order:
   * 1. Handlers registered via registerHandler()
   * 2. Handlers discovered via @WebviewHandler decorator (WebviewHandlerRegistry)
   */
  private async handleLocalRequest<TParams, TResult>(
    method: string,
    params: TParams | undefined,
  ): Promise<TResult> {
    // First check manually registered handlers
    let handler = this.requestHandlers.get(method);

    // Fall back to WebviewHandlerRegistry if available
    if (!handler && this.webviewHandlerRegistry) {
      handler = this.webviewHandlerRegistry.getHandler(method);
    }

    if (!handler) {
      throw new Error(`No handler registered for method: ${method}`);
    }

    return handler(params) as Promise<TResult>;
  }

  /**
   * Dispatch a notification to local handlers.
   */
  private dispatchLocalNotification<TParams>(
    method: string,
    params: TParams,
  ): void {
    const handlers = this.notificationHandlers.get(method);
    if (!handlers || handlers.size === 0) return;

    for (const handler of handlers) {
      try {
        handler(params);
      } catch (error) {
        console.error(`Error in notification handler for "${method}":`, error);
      }
    }
  }

  /**
   * Check if a message is a JSON-RPC request.
   */
  private isJsonRpcRequest(message: unknown): message is JsonRpcRequest {
    return (
      typeof message === 'object' &&
      message !== null &&
      'jsonrpc' in message &&
      'method' in message &&
      'id' in message
    );
  }

  /**
   * Generate a unique webview request ID.
   */
  private generateWebviewRequestId(): string {
    return `ext-${++this.webviewRequestIdCounter}-${Date.now()}`;
  }

  /**
   * Log a debug message.
   */
  private log(message: string): void {
    if (this.resolvedConfig.debug) {
      console.log(`[ExtensionMessageBus] ${message}`);
    }
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
 * Factory function to create an ExtensionMessageBus.
 *
 * @example
 * ```typescript
 * // In a NestJS module
 * {
 *   provide: MESSAGE_BUS,
 *   useFactory: (server, webview) =>
 *     createExtensionMessageBus(server, webview),
 *   inject: [STDIO_SERVER_PROCESS, WEBVIEW_PROVIDER],
 * }
 * ```
 */
export function createExtensionMessageBus(
  serverProcess: StdioServerProcess,
  webviewProvider: BaseWebviewProvider,
  webviewHandlerRegistry?: WebviewHandlerRegistry | null,
  config?: ExtensionMessageBusConfig,
): ExtensionMessageBus {
  return new ExtensionMessageBus(
    serverProcess,
    webviewProvider,
    webviewHandlerRegistry ?? null,
    config ?? {},
  );
}
