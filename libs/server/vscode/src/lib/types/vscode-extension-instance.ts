import type * as vscode from 'vscode';

/**
 * Extension instance returned by createExtensionFromModule.
 * VSCode supports both sync and async activate functions.
 */
export interface VscodeExtensionInstance {
  activate: (context: vscode.ExtensionContext) => void | Promise<void>;
  deactivate: () => void;
}
