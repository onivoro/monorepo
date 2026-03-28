/**
 * Standard JSON-RPC 2.0 error codes per specification.
 */
export const JsonRpcErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SERVER_ERROR_MIN: -32099,
  SERVER_ERROR_MAX: -32000,
} as const;

export type JsonRpcErrorCode =
  (typeof JsonRpcErrorCodes)[keyof typeof JsonRpcErrorCodes];

/**
 * Check if an error code is in the server error range (-32000 to -32099).
 */
export function isServerErrorCode(code: number): boolean {
  return (
    code >= JsonRpcErrorCodes.SERVER_ERROR_MIN &&
    code <= JsonRpcErrorCodes.SERVER_ERROR_MAX
  );
}
