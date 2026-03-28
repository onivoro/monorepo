import type * as vscode from 'vscode';

/**
 * Type alias for the VSCode API module.
 * This avoids circular type reference issues when injecting the API.
 */
export type VscodeApi = typeof vscode;

/**
 * Type alias for VSCode ExtensionContext.
 */
export type VscodeExtensionContext = vscode.ExtensionContext;

/**
 * Type alias for VSCode Disposable.
 */
export type VscodeDisposable = vscode.Disposable;

/**
 * Type alias for VSCode TextEditor.
 */
export type VscodeTextEditor = vscode.TextEditor;

/**
 * Type alias for VSCode TextEditorEdit.
 */
export type VscodeTextEditorEdit = vscode.TextEditorEdit;

/**
 * Type alias for VSCode QuickPickItem.
 */
export type VscodeQuickPickItem = vscode.QuickPickItem;

/**
 * Type alias for VSCode QuickPickOptions.
 */
export type VscodeQuickPickOptions = vscode.QuickPickOptions;

/**
 * Type alias for VSCode InputBoxOptions.
 */
export type VscodeInputBoxOptions = vscode.InputBoxOptions;

/**
 * Type alias for VSCode OutputChannel.
 */
export type VscodeOutputChannel = vscode.OutputChannel;

/**
 * Type alias for VSCode LogOutputChannel.
 */
export type VscodeLogOutputChannel = vscode.LogOutputChannel;

/**
 * Type alias for VSCode StatusBarItem.
 */
export type VscodeStatusBarItem = vscode.StatusBarItem;

/**
 * Type alias for VSCode StatusBarAlignment.
 */
export type VscodeStatusBarAlignment = vscode.StatusBarAlignment;

/**
 * Type alias for VSCode TextDocument.
 */
export type VscodeTextDocument = vscode.TextDocument;

/**
 * Type alias for VSCode TextDocumentShowOptions.
 */
export type VscodeTextDocumentShowOptions = vscode.TextDocumentShowOptions;

/**
 * Type alias for VSCode Terminal.
 */
export type VscodeTerminal = vscode.Terminal;

/**
 * Type alias for VSCode TerminalOptions.
 */
export type VscodeTerminalOptions = vscode.TerminalOptions;

/**
 * Type alias for VSCode Uri.
 */
export type VscodeUri = vscode.Uri;

/**
 * Type alias for VSCode ProgressOptions.
 */
export type VscodeProgressOptions = vscode.ProgressOptions;

/**
 * Type alias for VSCode Progress.
 */
export type VscodeProgress<T> = vscode.Progress<T>;

/**
 * Type alias for VSCode CancellationToken.
 */
export type VscodeCancellationToken = vscode.CancellationToken;

/**
 * Type alias for VSCode WorkspaceConfiguration.
 */
export type VscodeWorkspaceConfiguration = vscode.WorkspaceConfiguration;

/**
 * Type alias for VSCode ConfigurationScope.
 */
export type VscodeConfigurationScope = vscode.ConfigurationScope;

/**
 * Type alias for VSCode WorkspaceFolder.
 */
export type VscodeWorkspaceFolder = vscode.WorkspaceFolder;

/**
 * Type alias for VSCode GlobPattern.
 */
export type VscodeGlobPattern = vscode.GlobPattern;

/**
 * Type alias for VSCode WorkspaceEdit.
 */
export type VscodeWorkspaceEdit = vscode.WorkspaceEdit;

/**
 * Type alias for VSCode FileSystemWatcher.
 */
export type VscodeFileSystemWatcher = vscode.FileSystemWatcher;

/**
 * Type alias for VSCode TextDocumentContentProvider.
 */
export type VscodeTextDocumentContentProvider =
  vscode.TextDocumentContentProvider;

/**
 * Type alias for VSCode ConfigurationChangeEvent.
 */
export type VscodeConfigurationChangeEvent = vscode.ConfigurationChangeEvent;

/**
 * Type alias for VSCode Event.
 */
export type VscodeEvent<T> = vscode.Event<T>;

/**
 * Type alias for VSCode TextEditorSelectionChangeEvent.
 */
export type VscodeTextEditorSelectionChangeEvent =
  vscode.TextEditorSelectionChangeEvent;

/**
 * Type alias for VSCode TextEditorVisibleRangesChangeEvent.
 */
export type VscodeTextEditorVisibleRangesChangeEvent =
  vscode.TextEditorVisibleRangesChangeEvent;

/**
 * Type alias for VSCode TextEditorOptionsChangeEvent.
 */
export type VscodeTextEditorOptionsChangeEvent =
  vscode.TextEditorOptionsChangeEvent;

/**
 * Type alias for VSCode TextEditorViewColumnChangeEvent.
 */
export type VscodeTextEditorViewColumnChangeEvent =
  vscode.TextEditorViewColumnChangeEvent;

/**
 * Type alias for VSCode WindowState.
 */
export type VscodeWindowState = vscode.WindowState;

/**
 * Type alias for VSCode ViewColumn.
 */
export type VscodeViewColumn = vscode.ViewColumn;

/**
 * Type alias for VSCode DecorationRenderOptions.
 */
export type VscodeDecorationRenderOptions = vscode.DecorationRenderOptions;

/**
 * Type alias for VSCode TextEditorDecorationType.
 */
export type VscodeTextEditorDecorationType = vscode.TextEditorDecorationType;

/**
 * Type alias for VSCode MessageItem.
 */
export type VscodeMessageItem = vscode.MessageItem;

/**
 * Type alias for VSCode MessageOptions.
 */
export type VscodeMessageOptions = vscode.MessageOptions;

/**
 * Type alias for VSCode WorkspaceFolderPickOptions.
 */
export type VscodeWorkspaceFolderPickOptions =
  vscode.WorkspaceFolderPickOptions;

/**
 * Type alias for VSCode OpenDialogOptions.
 */
export type VscodeOpenDialogOptions = vscode.OpenDialogOptions;

/**
 * Type alias for VSCode SaveDialogOptions.
 */
export type VscodeSaveDialogOptions = vscode.SaveDialogOptions;

/**
 * Type alias for VSCode QuickPick.
 */
export type VscodeQuickPick<T extends vscode.QuickPickItem> =
  vscode.QuickPick<T>;

/**
 * Type alias for VSCode InputBox.
 */
export type VscodeInputBox = vscode.InputBox;

/**
 * Type alias for VSCode WebviewPanel.
 */
export type VscodeWebviewPanel = vscode.WebviewPanel;

/**
 * Type alias for VSCode WebviewPanelOptions.
 */
export type VscodeWebviewPanelOptions = vscode.WebviewPanelOptions;

/**
 * Type alias for VSCode WebviewOptions.
 */
export type VscodeWebviewOptions = vscode.WebviewOptions;

/**
 * Type alias for VSCode TreeDataProvider.
 */
export type VscodeTreeDataProvider<T> = vscode.TreeDataProvider<T>;

/**
 * Type alias for VSCode TreeView.
 */
export type VscodeTreeView<T> = vscode.TreeView<T>;

/**
 * Type alias for VSCode TreeViewOptions.
 */
export type VscodeTreeViewOptions<T> = vscode.TreeViewOptions<T>;

/**
 * Type alias for VSCode UriHandler.
 */
export type VscodeUriHandler = vscode.UriHandler;

/**
 * Type alias for VSCode WebviewPanelSerializer.
 */
export type VscodeWebviewPanelSerializer<T = unknown> =
  vscode.WebviewPanelSerializer<T>;
