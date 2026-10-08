import { VscodeWorkspaceService } from './vscode-workspace.service';

describe(VscodeWorkspaceService.name, () => {
  const workspace = {
    getConfiguration: jest.fn(),
    workspaceFolders: [{ name: 'root' }],
    name: 'ws',
    rootPath: '/ws',
    openTextDocument: jest.fn(),
    findFiles: jest.fn(),
    saveAll: jest.fn(),
    applyEdit: jest.fn(),
    createFileSystemWatcher: jest.fn(),
    registerTextDocumentContentProvider: jest.fn(),
    getWorkspaceFolder: jest.fn(),
    asRelativePath: jest.fn(),
    onDidChangeConfiguration: jest.fn(),
    onDidOpenTextDocument: jest.fn(),
    onDidCloseTextDocument: jest.fn(),
    onDidSaveTextDocument: jest.fn(),
  };
  const service = new VscodeWorkspaceService({ workspace } as never);

  beforeEach(() => jest.clearAllMocks());

  it('exposes workspace properties', () => {
    expect(service.workspaceFolders).toBe(workspace.workspaceFolders);
    expect(service.name).toBe('ws');
    expect(service.rootPath).toBe('/ws');
  });

  it.each([
    ['getConfiguration', ['section', null]],
    ['openTextDocument', ['/a.txt']],
    ['findFiles', ['**/*.ts', null, 10]],
    ['saveAll', [true]],
    ['applyEdit', [{ edit: 1 }]],
    ['createFileSystemWatcher', ['**/*', true, false, true]],
    ['registerTextDocumentContentProvider', ['scheme', { p: 1 }]],
    ['getWorkspaceFolder', [{ fsPath: '/a' }]],
    ['asRelativePath', ['/ws/a', false]],
    ['onDidChangeConfiguration', [jest.fn()]],
    ['onDidOpenTextDocument', [jest.fn()]],
    ['onDidCloseTextDocument', [jest.fn()]],
    ['onDidSaveTextDocument', [jest.fn()]],
  ] as const)('%s delegates to vscode.workspace', async (method, args) => {
    const target = workspace[method] as jest.Mock;
    target.mockReturnValue(`${method}-result`);

    const result = await (
      service[method] as (...a: unknown[]) => unknown
    ).apply(service, args as unknown as unknown[]);

    expect(result).toBe(`${method}-result`);
    expect(target).toHaveBeenCalledWith(...args);
  });
});
