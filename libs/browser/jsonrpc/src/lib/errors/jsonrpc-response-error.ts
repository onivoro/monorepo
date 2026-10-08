import { JsonRpcError } from '@onivoro/isomorphic-jsonrpc';

/**
 * Error a request promise rejects with when the response carries a JSON-RPC
 * `error`. Keeps the error's `code` and `data` alongside its `message`.
 */
export class JsonRpcResponseError extends Error implements JsonRpcError {
  readonly code: number;
  readonly data?: unknown;

  constructor(error: JsonRpcError) {
    super(error.message || 'Unknown error');
    this.name = 'JsonRpcResponseError';
    this.code = error.code;
    this.data = error.data;
  }
}
