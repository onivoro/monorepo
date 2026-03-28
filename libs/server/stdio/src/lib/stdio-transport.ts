import { tryJsonParse } from '@onivoro/isomorphic-common';
import { randomUUID } from 'crypto';
import * as readline from 'readline';
import {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcErrorCodes,
  JsonRpcHandlerFn,
  JsonRpcId,
  JSONRPC_VERSION,
} from '@onivoro/isomorphic-jsonrpc';

/**
 * A JSON-RPC 2.0 transport layer for stdio-based communication.
 *
 * This class handles:
 * - Reading line-delimited JSON messages from stdin
 * - Routing messages to registered handlers based on method name
 * - Sending JSON responses to stdout
 * - Error handling with standard JSON-RPC 2.0 error codes
 *
 * @example
 * ```typescript
 * const transport = new StdioTransport();
 *
 * transport.on('health', async () => {
 *   return { status: 'ok' };
 * });
 *
 * transport.on('user.get', async (params: { id: string }) => {
 *   return { id: params.id, name: 'John' };
 * });
 * ```
 */
export class StdioTransport {
  private handlers: Map<string, JsonRpcHandlerFn> = new Map();
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    this.rl.on('line', (line) => this.handleMessage(line));
  }

  /**
   * Register a handler for a specific method.
   *
   * @param method - The method name to handle
   * @param handler - Async function that processes the request
   */
  on<TParams = unknown, TResult = unknown>(
    method: string,
    handler: JsonRpcHandlerFn<TParams, TResult>,
  ): void {
    if (this.handlers.has(method)) {
      throw new Error(
        `Handler already registered for method: ${method}. Use removeHandler() before re-registering.`,
      );
    }
    this.handlers.set(method, handler as JsonRpcHandlerFn);
  }

  /**
   * Remove a registered handler for a method.
   *
   * @param method - The method name to remove the handler for
   */
  removeHandler(method: string): void {
    this.handlers.delete(method);
  }

  /**
   * Check if a handler is registered for a method.
   */
  hasHandler(method: string): boolean {
    return this.handlers.has(method);
  }

  /**
   * Get all registered method names.
   */
  getRegisteredMethods(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Send a response back through stdout.
   */
  private send(
    id: JsonRpcId,
    result?: unknown,
    error?: JsonRpcResponse['error'],
  ): void {
    const response: JsonRpcResponse = {
      jsonrpc: JSONRPC_VERSION,
      id,
      ...(error ? { error } : { result }),
    };
    process.stdout.write(JSON.stringify(response) + '\n');
  }

  /**
   * Handle incoming message from stdin.
   */
  private async handleMessage(line: string): Promise<void> {
    try {
      const message: JsonRpcRequest | null = tryJsonParse(line);

      if (message?.id === undefined) {
        return;
      }

      if (!message?.method) {
        this.send(randomUUID(), undefined, {
          code: JsonRpcErrorCodes.INVALID_REQUEST,
          message: 'Method not specified',
        });
        return;
      }

      const handler = this.handlers.get(message.method);
      if (!handler) {
        this.send(message.id, undefined, {
          code: JsonRpcErrorCodes.METHOD_NOT_FOUND,
          message: `Method not found: ${message.method}`,
        });
        return;
      }

      try {
        const result = await handler(message.params);
        this.send(message.id, result);
      } catch (error) {
        this.send(message.id, undefined, {
          code: JsonRpcErrorCodes.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Internal error',
          data: error instanceof Error ? error.stack : undefined,
        });
      }
    } catch {
      // Invalid JSON - send parse error with null id per spec
      this.send(null, undefined, {
        code: JsonRpcErrorCodes.PARSE_ERROR,
        message: 'Parse error',
      });
    }
  }

  /**
   * Close the transport and release resources.
   */
  close(): void {
    this.rl.close();
  }
}
