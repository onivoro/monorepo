/**
 * Injection tokens for VSCode-related dependencies.
 */

/** Injection token for the VSCode ExtensionContext */
export const VSCODE_EXTENSION_CONTEXT = Symbol('VSCODE_EXTENSION_CONTEXT');

/** Injection token for the VSCode API module */
export const VSCODE_API = Symbol('VSCODE_API');

/** Injection token for the StdioServerProcess */
export const STDIO_SERVER_PROCESS = Symbol('STDIO_SERVER_PROCESS');

/** Injection token for the webview provider */
export const WEBVIEW_PROVIDER = Symbol('WEBVIEW_PROVIDER');
