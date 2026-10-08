import { isServerErrorCode, JsonRpcErrorCodes } from './jsonrpc-error-codes';

describe('JsonRpcErrorCodes', () => {
  it('matches the JSON-RPC 2.0 specification', () => {
    expect(JsonRpcErrorCodes).toEqual({
      PARSE_ERROR: -32700,
      INVALID_REQUEST: -32600,
      METHOD_NOT_FOUND: -32601,
      INVALID_PARAMS: -32602,
      INTERNAL_ERROR: -32603,
      SERVER_ERROR_MIN: -32099,
      SERVER_ERROR_MAX: -32000,
    });
  });
});

describe('isServerErrorCode', () => {
  it.each([-32000, -32050, -32099])('accepts %i', (code) => {
    expect(isServerErrorCode(code)).toBe(true);
  });

  it.each([-31999, -32100, -32700, -32601, 0, 1])('rejects %i', (code) => {
    expect(isServerErrorCode(code)).toBe(false);
  });
});
