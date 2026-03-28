import { Injectable, Inject } from '@nestjs/common';
import { VSCODE_API } from './vscode-injection-tokens';
import {
  VscodeApi,
  VscodeConfigurationScope,
  VscodeWorkspaceConfiguration,
  VscodeWorkspaceFolder,
  VscodeUri,
  VscodeTextDocument,
  VscodeGlobPattern,
  VscodeWorkspaceEdit,
  VscodeFileSystemWatcher,
  VscodeTextDocumentContentProvider,
  VscodeDisposable,
  VscodeConfigurationChangeEvent,
} from './vscode-api-type';

/**
 * Injectable service that wraps VSCode workspace API.
 *
 * Provides a NestJS-friendly interface to vscode.workspace.
 *
 * @example
 * ```typescript
 * @Injectable()
 * class MyService {
 *   constructor(private readonly workspace: VscodeWorkspaceService) {}
 *
 *   async readConfig() {
 *     const config = this.workspace.getConfiguration('myExtension');
 *     return config.get('someSetting');
 *   }
 * }
 * ```
 */
@Injectable()
export class VscodeWorkspaceService {
  constructor(@Inject(VSCODE_API) private readonly vscodeApi: VscodeApi) {}

  /**
   * Get a workspace configuration.
   */
  getConfiguration(
    section?: string,
    scope?: VscodeConfigurationScope | null,
  ): VscodeWorkspaceConfiguration {
    return this.vscodeApi.workspace.getConfiguration(section, scope);
  }

  /**
   * Get workspace folders.
   */
  get workspaceFolders(): readonly VscodeWorkspaceFolder[] | undefined {
    return this.vscodeApi.workspace.workspaceFolders;
  }

  /**
   * Get the workspace name.
   */
  get name(): string | undefined {
    return this.vscodeApi.workspace.name;
  }

  /**
   * Get the root path (deprecated, use workspaceFolders).
   */
  get rootPath(): string | undefined {
    return this.vscodeApi.workspace.rootPath;
  }

  /**
   * Open a text document.
   */
  async openTextDocument(
    uriOrFileNameOrOptions?:
      | VscodeUri
      | string
      | { language?: string; content?: string },
  ): Promise<VscodeTextDocument> {
    return this.vscodeApi.workspace.openTextDocument(
      uriOrFileNameOrOptions as VscodeUri,
    );
  }

  /**
   * Find files in the workspace.
   */
  async findFiles(
    include: VscodeGlobPattern,
    exclude?: VscodeGlobPattern | null,
    maxResults?: number,
  ): Promise<VscodeUri[]> {
    return this.vscodeApi.workspace.findFiles(include, exclude, maxResults);
  }

  /**
   * Save all dirty files.
   */
  async saveAll(includeUntitled?: boolean): Promise<boolean> {
    return this.vscodeApi.workspace.saveAll(includeUntitled);
  }

  /**
   * Apply a workspace edit.
   */
  async applyEdit(edit: VscodeWorkspaceEdit): Promise<boolean> {
    return this.vscodeApi.workspace.applyEdit(edit);
  }

  /**
   * Create a file system watcher.
   */
  createFileSystemWatcher(
    globPattern: VscodeGlobPattern,
    ignoreCreateEvents?: boolean,
    ignoreChangeEvents?: boolean,
    ignoreDeleteEvents?: boolean,
  ): VscodeFileSystemWatcher {
    return this.vscodeApi.workspace.createFileSystemWatcher(
      globPattern,
      ignoreCreateEvents,
      ignoreChangeEvents,
      ignoreDeleteEvents,
    );
  }

  /**
   * Register a text document content provider.
   */
  registerTextDocumentContentProvider(
    scheme: string,
    provider: VscodeTextDocumentContentProvider,
  ): VscodeDisposable {
    return this.vscodeApi.workspace.registerTextDocumentContentProvider(
      scheme,
      provider,
    );
  }

  /**
   * Get the workspace folder for a resource.
   */
  getWorkspaceFolder(uri: VscodeUri): VscodeWorkspaceFolder | undefined {
    return this.vscodeApi.workspace.getWorkspaceFolder(uri);
  }

  /**
   * As relative path.
   */
  asRelativePath(
    pathOrUri: string | VscodeUri,
    includeWorkspaceFolder?: boolean,
  ): string {
    return this.vscodeApi.workspace.asRelativePath(
      pathOrUri,
      includeWorkspaceFolder,
    );
  }

  /**
   * Register an on-did-change configuration event.
   */
  onDidChangeConfiguration(
    listener: (e: VscodeConfigurationChangeEvent) => void,
  ): VscodeDisposable {
    return this.vscodeApi.workspace.onDidChangeConfiguration(listener);
  }

  /**
   * Register an on-did-open text document event.
   */
  onDidOpenTextDocument(
    listener: (document: VscodeTextDocument) => void,
  ): VscodeDisposable {
    return this.vscodeApi.workspace.onDidOpenTextDocument(listener);
  }

  /**
   * Register an on-did-close text document event.
   */
  onDidCloseTextDocument(
    listener: (document: VscodeTextDocument) => void,
  ): VscodeDisposable {
    return this.vscodeApi.workspace.onDidCloseTextDocument(listener);
  }

  /**
   * Register an on-did-save text document event.
   */
  onDidSaveTextDocument(
    listener: (document: VscodeTextDocument) => void,
  ): VscodeDisposable {
    return this.vscodeApi.workspace.onDidSaveTextDocument(listener);
  }
}
