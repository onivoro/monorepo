import { OAuthError, OAuthErrorCode } from '@modelcontextprotocol/server';

/**
 * The error a token verifier throws for a token it rejects. The MCP SDK answers it with
 * `401` and a `WWW-Authenticate: Bearer error="invalid_token"` challenge; any other error
 * becomes a `500`.
 */
export function invalidTokenError(message: string): OAuthError {
  return new OAuthError(OAuthErrorCode.InvalidToken, message);
}

/** Whether an error is one {@link invalidTokenError} made. */
export function isInvalidTokenError(error: unknown): error is OAuthError {
  return (
    error instanceof OAuthError && error.code === OAuthErrorCode.InvalidToken
  );
}
