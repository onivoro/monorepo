import { CspOptions } from '../types/csp-options';

/**
 * Generate a Content Security Policy meta tag for a webview.
 */
export function generateCspMetaTag(options: CspOptions): string {
  const {
    webview,
    nonce,
    allowUnsafeInlineStyles = true,
    additionalScriptSrc = [],
    additionalStyleSrc = [],
    additionalImgSrc = [],
    additionalFontSrc = [],
  } = options;

  const scriptSrc = [
    `'nonce-${nonce}'`,
    "'unsafe-inline'",
    ...additionalScriptSrc,
  ].join(' ');
  const styleSrc = [
    webview.cspSource,
    ...(allowUnsafeInlineStyles ? ["'unsafe-inline'"] : []),
    ...additionalStyleSrc,
  ].join(' ');
  const imgSrc = [
    webview.cspSource,
    'https:',
    'data:',
    ...additionalImgSrc,
  ].join(' ');
  const fontSrc = [webview.cspSource, ...additionalFontSrc].join(' ');

  return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${styleSrc}; script-src ${scriptSrc}; img-src ${imgSrc}; font-src ${fontSrc};">`;
}
