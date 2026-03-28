import { JSONRPC_VERSION } from './jsonrpc-request';

/**
 * A notification per JSON-RPC 2.0 specification.
 */
export interface JsonRpcNotification<TParams = unknown> {
  jsonrpc: typeof JSONRPC_VERSION;
  method: string;
  params?: TParams;
}

/**
 * Type guard to check if a message is a notification (request without id).
 */
export function isJsonRpcNotification(
  message: unknown,
): message is JsonRpcNotification {
  return (
    typeof message === 'object' &&
    message !== null &&
    'jsonrpc' in message &&
    (message as JsonRpcNotification).jsonrpc === '2.0' &&
    'method' in message &&
    typeof (message as JsonRpcNotification).method === 'string' &&
    !('id' in message)
  );
}
