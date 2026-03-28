/**
 * Generate a cryptographically secure nonce for Content Security Policy.
 * @param length - Length of the nonce (default: 32)
 */
export function generateNonce(length = 32): string {
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < length; i++) {
    nonce += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return nonce;
}
