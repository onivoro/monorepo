/**
 * Creates a structurally valid but unsigned JWT for unit tests.
 * The token has a proper header.payload.signature structure and is decodable
 * by `jsonwebtoken.decode()`, but the signature is not cryptographically valid.
 *
 * For tests that need signature validation, use a real RSA key pair
 * with `jsonwebtoken.sign()` instead.
 */
export function createMockJwt(claims?: Record<string, unknown>): string {
  const header = { alg: 'RS256', typ: 'JWT', kid: 'test-kid' };
  const payload = {
    sub: 'test-subject',
    client_id: 'test-client',
    scope: 'read write',
    iss: 'https://test-issuer.example.com',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    ...claims,
  };

  const encode = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');

  return `${encode(header)}.${encode(payload)}.mock-signature`;
}
