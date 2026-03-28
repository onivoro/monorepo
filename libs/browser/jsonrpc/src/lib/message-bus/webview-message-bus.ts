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
  combineDisposables,
} from '@onivoro/isomorphic-jsonrpc';

/**
 * Configuration for the WebviewMessageBus.
 */
export interface WebviewMessageBusConfig {
  /** Custom timeout for requests in milliseconds. Default: 30000 */
  requestTimeoutMs?: number;
  /** Custom event name for responses. Default: 'vscode-message' */
  responseEventName?: string;
}

/**
 * Interface for the VSCode API bridge available in webview context.
 */
export interface VscodeApiBridge {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
}

/**
 * MessageBus implementation for browser/webview environment.
 */
export class WebviewMessageBus implements MessageBus {
  private readonly config: Required<WebviewMessageBusConfig>;
  private readonly vscodeApi: VscodeApiBridge;
  private readonly pendingRequests: Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timeoutId: ReturnType<typeof setTimeout>;
    }
  > = new Map();
  private readonly notificationHandlers: Map<
    string,
    Set<(params: unknown) => void>
  > = new Map();
  private readonly requestHandlers: Map<string, JsonRpcHandlerFn> = new Map();
  private readonly handlerOptions: Map<string, HandlerRegistrationOptions> =
    new Map();
  private requestIdCounter = 0;
  private disposed = false;
  private readonly messageListener: (event: Event) => void;

  constructor(
    vscodeApi: VscodeApiBridge,
    config: WebviewMessageBusConfig = {},
  ) {
    this.vscodeApi = vscodeApi;
    this.config = {
      requestTimeoutMs: config.requestTimeoutMs ?? 30000,
      responseEventName: config.responseEventName ?? 'vscode-message',
    };

    this.messageListener = (event: Event) => {
      const customEvent = event as CustomEvent;
      this.handleIncomingMessage(customEvent.detail);
    };
    window.addEventListener(
      this.config.responseEventName,
      this.messageListener,
    );
  }

  sendRequest<TParams = unknown, TResult = unknown>(
    method: string,
    params?: TParams,
    options?: SendRequestOptions,
  ): Promise<TResult> {
    this.ensureNotDisposed();

    return new Promise((resolve, reject) => {
      const id = this.generateRequestId();
      const timeoutMs = options?.timeoutMs ?? this.config.requestTimeoutMs;

      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout after ${timeoutMs}ms: ${method}`));
      }, timeoutMs);

      this.pendingRequests.set(id, {
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

      this.vscodeApi.postMessage(request);
    });
  }

  sendNotification<TParams = unknown>(method: string, params?: TParams): void {
    this.ensureNotDisposed();

    const notification: JsonRpcNotification<TParams> = {
      jsonrpc: JSONRPC_VERSION,
      method,
      params,
    };

    this.vscodeApi.postMessage(notification);
  }

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

    return () => {
      this.requestHandlers.delete(method);
      this.handlerOptions.delete(method);
    };
  }

  getRegisteredHandlers(): HandlerInfo[] {
    return Array.from(this.requestHandlers.keys()).map((method) => ({
      method,
      canBeOverwritten: this.handlerOptions.get(method)?.overwrite ?? false,
    }));
  }

  hasHandler(method: string): boolean {
    return this.requestHandlers.has(method);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    window.removeEventListener(
      this.config.responseEventName,
      this.messageListener,
    );

    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error('MessageBus disposed'));
    }
    this.pendingRequests.clear();

    this.notificationHandlers.clear();
    this.requestHandlers.clear();
    this.handlerOptions.clear();
  }

  private handleIncomingMessage(message: unknown): void {
    if (!message || typeof message !== 'object') return;

    const msg = message as Record<string, unknown>;

    if ('id' in msg && msg.id !== undefined) {
      this.handleResponse(msg as unknown as JsonRpcResponse);
      return;
    }

    if ('method' in msg && typeof msg.method === 'string') {
      if (!('id' in msg)) {
        this.handleNotification(msg as unknown as JsonRpcNotification);
      } else {
        this.handleRequest(msg as unknown as JsonRpcRequest);
      }
    }
  }

  private handleResponse(response: JsonRpcResponse): void {
    const id = String(response.id);
    const pending = this.pendingRequests.get(id);

    if (!pending) return;

    clearTimeout(pending.timeoutId);
    this.pendingRequests.delete(id);

    if (response.error) {
      pending.reject(new Error(response.error.message || 'Unknown error'));
    } else {
      pending.resolve(response.result);
    }
  }

  private handleNotification(notification: JsonRpcNotification): void {
    const handlers = this.notificationHandlers.get(notification.method);
    if (!handlers || handlers.size === 0) return;

    for (const handler of handlers) {
      try {
        handler(notification.params);
      } catch (error) {
        console.error(
          `Error in notification handler for "${notification.method}":`,
          error,
        );
      }
    }
  }

  private async handleRequest(request: JsonRpcRequest): Promise<void> {
    const handler = this.requestHandlers.get(request.method);

    if (!handler) {
      this.vscodeApi.postMessage({
        jsonrpc: JSONRPC_VERSION,
        id: request.id,
        error: {
          code: -32601,
          message: `Method not found: ${request.method}`,
        },
      });
      return;
    }

    try {
      const result = await handler(request.params);
      this.vscodeApi.postMessage({
        jsonrpc: JSONRPC_VERSION,
        id: request.id,
        result,
      });
    } catch (error) {
      this.vscodeApi.postMessage({
        jsonrpc: JSONRPC_VERSION,
        id: request.id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
        },
      });
    }
  }

  private generateRequestId(): string {
    return `webview-${++this.requestIdCounter}-${Date.now()}`;
  }

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('MessageBus has been disposed');
    }
  }
}

/**
 * Creates a WebviewMessageBus using the global window.vscodeApi.
 */
export function createWebviewMessageBus(
  config?: WebviewMessageBusConfig,
): WebviewMessageBus {
  const vscodeApi = (window as unknown as { vscodeApi?: VscodeApiBridge })
    .vscodeApi;

  if (!vscodeApi) {
    throw new Error(
      'VSCode API not available. This function must be called from within a VSCode webview.',
    );
  }

  return new WebviewMessageBus(vscodeApi, config);
}

/**
 * Creates a WebviewMessageBus with a custom VscodeApiBridge.
 */
export function createWebviewMessageBusWithApi(
  vscodeApi: VscodeApiBridge,
  config?: WebviewMessageBusConfig,
): WebviewMessageBus {
  return new WebviewMessageBus(vscodeApi, config);
}
