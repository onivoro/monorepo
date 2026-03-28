/**
 * Add nonce attributes to all script tags in HTML content.
 * @param html - The HTML content to process
 * @param nonce - The nonce to add to script tags
 */
export function addNonceToScripts(html: string, nonce: string): string {
  let result = html;

  // Handle script tags with attributes (but no nonce yet)
  result = result.replace(/<script(\s)/g, `<script nonce="${nonce}"$1`);

  // Handle script tags without attributes
  result = result.replace(/<script>/g, `<script nonce="${nonce}">`);

  // Remove duplicate nonces that may have been added
  result = result.replace(
    new RegExp(`<script nonce="${nonce}" nonce="`, 'g'),
    `<script nonce="`,
  );

  return result;
}
