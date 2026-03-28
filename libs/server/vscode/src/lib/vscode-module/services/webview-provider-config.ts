/**
 * Configuration options for BaseWebviewProvider.
 */
export interface WebviewProviderConfig {
  /** Relative path from extension root to the webview dist folder */
  webviewDistPath: string;
  /** Enable cache busting for assets (default: true) */
  enableCacheBusting?: boolean;
  /** Allow unsafe-inline for styles (default: true) */
  allowUnsafeInlineStyles?: boolean;
}
