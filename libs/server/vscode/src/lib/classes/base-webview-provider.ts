import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { generateNonce } from '../functions/generate-nonce';
import { generateCspMetaTag } from '../functions/generate-csp-meta-tag';
import { generateVscodeApiBridgeScript } from '../functions/generate-vscode-api-bridge-script';
import { addNonceToScripts } from '../functions/add-nonce-to-scripts';
import { WebviewProviderConfig } from '../vscode-module/services/webview-provider-config';
import { WebviewMessageHandler } from '../vscode-module/services/webview-message-handler';

/**
 * Abstract base class for VSCode webview providers.
 *
 * Provides common functionality for:
 * - Loading and preprocessing HTML content
 * - Asset URI conversion for webview security
 * - Content Security Policy with nonce support
 * - VSCode API bridge injection
 * - Message handling between webview and extension
 *
 * @example
 * ```typescript
 * export class MyWebviewProvider extends BaseWebviewProvider {
 *   public static readonly viewType = 'myExtension.webview';
 *
 *   constructor(extensionUri: vscode.Uri) {
 *     super(extensionUri, { webviewDistPath: 'dist/webview' });
 *   }
 * }
 * ```
 */
export abstract class BaseWebviewProvider
  implements vscode.WebviewViewProvider
{
  protected _view?: vscode.WebviewView;
  protected _messageHandler?: WebviewMessageHandler;
  protected readonly config: Required<WebviewProviderConfig>;

  constructor(
    protected readonly extensionUri: vscode.Uri,
    config: WebviewProviderConfig,
  ) {
    this.config = {
      webviewDistPath: config.webviewDistPath,
      enableCacheBusting: config.enableCacheBusting ?? true,
      allowUnsafeInlineStyles: config.allowUnsafeInlineStyles ?? true,
    };
  }

  /**
   * Called by VSCode when the webview view needs to be resolved.
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    this.updateWebviewContent(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message) => {
      if (this._messageHandler) {
        this._messageHandler(message);
      }
    });
  }

  /**
   * Update the webview HTML content.
   */
  protected updateWebviewContent(webview: vscode.Webview): void {
    webview.html = this.getHtmlForWebview(webview);
  }

  /**
   * Reload the webview content. Useful for development.
   */
  public reload(): void {
    if (this._view) {
      this.updateWebviewContent(this._view.webview);
    }
  }

  /**
   * Register a handler for messages from the webview.
   */
  public onMessage(handler: WebviewMessageHandler): void {
    this._messageHandler = handler;
  }

  /**
   * Send a message to the webview.
   */
  public postMessage(message: unknown): Thenable<boolean> | undefined {
    return this._view?.webview.postMessage(message);
  }

  /**
   * Get the current webview view instance.
   */
  public get view(): vscode.WebviewView | undefined {
    return this._view;
  }

  /**
   * Get the full path to the webview dist folder.
   */
  protected getWebviewPath(): string {
    return path.join(this.extensionUri.fsPath, this.config.webviewDistPath);
  }

  /**
   * Generate the HTML content for the webview.
   * Override this method to customize the HTML generation.
   */
  protected getHtmlForWebview(webview: vscode.Webview): string {
    const webviewPath = this.getWebviewPath();
    const indexPath = path.join(webviewPath, 'index.html');

    let html = fs.readFileSync(indexPath, 'utf8');

    // Convert asset paths to webview URIs
    html = this.convertAssetPaths(html, webview, webviewPath);

    // Generate nonce for CSP
    const nonce = generateNonce();

    // Add CSP meta tag
    const cspMeta = generateCspMetaTag({
      webview,
      nonce,
      allowUnsafeInlineStyles: this.config.allowUnsafeInlineStyles,
    });
    html = html.replace('<head>', `<head>\n${cspMeta}`);

    // Inject VSCode API bridge script
    const vscodeApiScript = generateVscodeApiBridgeScript(nonce);
    html = html.replace(cspMeta, `${cspMeta}${vscodeApiScript}`);

    // Inject custom scripts from subclass (before the app scripts load)
    const customScripts = this.getInjectedScripts(nonce);
    if (customScripts) {
      html = html.replace(
        vscodeApiScript,
        `${vscodeApiScript}${customScripts}`,
      );
    }

    // Add nonce to existing script tags
    html = addNonceToScripts(html, nonce);

    return html;
  }

  /**
   * Override this method to inject custom scripts into the webview.
   * Scripts are injected after the VSCode API bridge but before the app loads.
   *
   * @param nonce - The CSP nonce to use for script tags
   * @returns Script tag(s) to inject, or undefined/empty string for none
   *
   * @example
   * ```typescript
   * protected getInjectedScripts(nonce: string): string {
   *   return `
   *     <script nonce="${nonce}">
   *       window.MY_CONFIG = { apiUrl: '${this.apiUrl}' };
   *     </script>
   *   `;
   * }
   * ```
   */
  protected getInjectedScripts(_nonce: string): string | undefined {
    return undefined;
  }

  /**
   * Convert asset paths in HTML to webview-safe URIs.
   */
  protected convertAssetPaths(
    html: string,
    webview: vscode.Webview,
    webviewPath: string,
  ): string {
    const cacheBuster = this.config.enableCacheBusting
      ? `?v=${Date.now()}`
      : '';

    // Match src and href attributes with absolute paths
    const assetPathRegex = /(src|href)="(\/[^"]+)"/g;

    return html.replace(assetPathRegex, (match, attr, assetPath) => {
      // Import vscode dynamically to avoid issues at module load time
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const vscode = require('vscode');
      const assetUri = webview.asWebviewUri(
        vscode.Uri.file(path.join(webviewPath, assetPath.substring(1))),
      );
      return `${attr}="${assetUri}${cacheBuster}"`;
    });
  }
}
