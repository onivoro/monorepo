/**
 * Error structure following JSON-RPC 2.0 specification.
 */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}
