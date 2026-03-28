import type * as vscode from 'vscode';
import { StdioServerProcess } from '@onivoro/server-stdio';
import { BaseWebviewProvider } from '../classes/base-webview-provider';

/**
 * Options for configuring the VscodeModule.
 */
export interface VscodeModuleOptions<
  TWebviewProvider extends BaseWebviewProvider = BaseWebviewProvider,
> {
  /** The VSCode extension context */
  context: vscode.ExtensionContext;

  /** The VSCode API module (require('vscode')) */
  vscodeApi: typeof vscode;

  /** The stdio server process for communicating with the backend */
  serverProcess: StdioServerProcess;

  /** Optional webview provider instance */
  webviewProvider?: TWebviewProvider;
}
