import { VscodeCommandsService } from './vscode-commands.service';

describe(VscodeCommandsService.name, () => {
  const commands = {
    executeCommand: jest.fn(),
    registerCommand: jest.fn(),
    registerTextEditorCommand: jest.fn(),
    getCommands: jest.fn(),
  };
  let context: { subscriptions: unknown[] };
  let service: VscodeCommandsService;

  beforeEach(() => {
    jest.clearAllMocks();
    context = { subscriptions: [] };
    service = new VscodeCommandsService(
      { commands } as never,
      context as never,
    );
  });

  it('executes commands with arguments', async () => {
    commands.executeCommand.mockResolvedValue('done');
    await expect(service.executeCommand('a.b', 1, 'x')).resolves.toBe('done');
    expect(commands.executeCommand).toHaveBeenCalledWith('a.b', 1, 'x');
  });

  it('registers commands and tracks the disposable', () => {
    const disposable = { dispose: jest.fn() };
    commands.registerCommand.mockReturnValue(disposable);
    const cb = jest.fn();

    expect(service.registerCommand('a.b', cb)).toBe(disposable);
    expect(commands.registerCommand).toHaveBeenCalledWith('a.b', cb);
    expect(context.subscriptions).toEqual([disposable]);
  });

  it('registers text editor commands and tracks the disposable', () => {
    const disposable = { dispose: jest.fn() };
    commands.registerTextEditorCommand.mockReturnValue(disposable);
    const cb = jest.fn();

    expect(service.registerTextEditorCommand('a.t', cb)).toBe(disposable);
    expect(commands.registerTextEditorCommand).toHaveBeenCalledWith('a.t', cb);
    expect(context.subscriptions).toEqual([disposable]);
  });

  it('lists commands passing filterInternal through', async () => {
    commands.getCommands.mockResolvedValue(['x']);
    await expect(service.getCommands(true)).resolves.toEqual(['x']);
    expect(commands.getCommands).toHaveBeenCalledWith(true);
  });
});
