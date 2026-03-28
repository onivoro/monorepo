import type * as vscode from 'vscode';

/**
 * Options for generating Content Security Policy.
 */
export interface CspOptions {
  /** The webview to generate CSP for */
  webview: vscode.Webview;
  /** The nonce to use for inline scripts */
  nonce: string;
  /** Allow unsafe-inline for styles (default: true for development compatibility) */
  allowUnsafeInlineStyles?: boolean;
  /** Additional script sources */
  additionalScriptSrc?: string[];
  /** Additional style sources */
  additionalStyleSrc?: string[];
  /** Additional image sources */
  additionalImgSrc?: string[];
  /** Additional font sources */
  additionalFontSrc?: string[];
}
