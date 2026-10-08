import { Injectable, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { StdioServerProcess } from '@onivoro/server-stdio';
import { CommandHandler } from './command-handler';
import { createExtensionFromModule } from './create-extension-from-module';
import { VscodeExtensionModule } from './decorators/vscode-extension-module.decorator';
import { ExtensionMessageBus } from './extension-message-bus';
import { VscodeModule } from './vscode-module';

const vscodeMock = {
  Uri: { file: jest.fn((p: string) => ({ fsPath: p })) },
  window: {
    createOutputChannel: jest.fn(),
    registerWebviewViewProvider: jest.fn(),
  },
  commands: { registerCommand: jest.fn() },
};
jest.mock('vscode', () => vscodeMock, { virtual: true });

jest.mock('@onivoro/server-stdio', () => ({
  StdioServerProcess: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
  })),
}));

const StdioServerProcessMock = StdioServerProcess as unknown as jest.Mock;

@Injectable()
class Commands {
  @CommandHandler('ext.hello')
  hello() {
    return 'hi';
  }
}

@Injectable()
class MissingCommands {}

function makeContext() {
  return {
    extensionPath: '/ext',
    subscriptions: [] as Array<{ dispose: () => unknown }>,
  };
}

function makeApp(overrides: Partial<Record<'get' | 'close', jest.Mock>> = {}) {
  return {
    get: jest.fn((token: unknown) => {
      if (token === ExtensionMessageBus) {
        return { getRegisteredHandlers: () => [{ method: 'a' }] };
      }
      if (token === Commands) return new Commands();
      throw new Error(
        `no provider ${String((token as { name?: string }).name)}`,
      );
    }),
    close: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe(createExtensionFromModule.name, () => {
  const webviewProvider = { kind: 'provider' };
  const createWebviewProvider = jest.fn(() => webviewProvider);
  const log = jest.fn();
  const error = jest.fn();
  const outputChannel = {
    appendLine: jest.fn(),
    show: jest.fn(),
    dispose: jest.fn(),
  };
  let createContext: jest.SpyInstance;
  let app: ReturnType<typeof makeApp>;

  function defineModule(
    extra: Partial<Parameters<typeof VscodeExtensionModule>[0]> = {},
  ) {
    @VscodeExtensionModule({
      name: 'TestExt',
      serverScript: 'dist/server.js',
      webviewViewType: 'test.view',
      createWebviewProvider: createWebviewProvider as never,
      commandHandlerTokens: [Commands, MissingCommands],
      logging: { log, error },
      ...extra,
    })
    @Module({})
    class TestExtModule {}
    return TestExtModule;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    vscodeMock.window.createOutputChannel.mockReturnValue(outputChannel);
    vscodeMock.window.registerWebviewViewProvider.mockReturnValue({
      dispose: jest.fn(),
      tag: 'webview-registration',
    });
    vscodeMock.commands.registerCommand.mockImplementation((id: string) => ({
      dispose: jest.fn(),
      id,
    }));
    app = makeApp();
    createContext = jest
      .spyOn(NestFactory, 'createApplicationContext')
      .mockResolvedValue(app as never);
  });

  afterEach(() => jest.restoreAllMocks());

  it('throws for modules without @VscodeExtensionModule', () => {
    @Module({})
    class Plain {}
    expect(() => createExtensionFromModule(Plain)).toThrow(
      'Module Plain is not decorated with @VscodeExtensionModule',
    );
  });

  it('activates: starts the server, bootstraps Nest and registers webview + commands', async () => {
    const forRoot = jest.spyOn(VscodeModule, 'forRoot');
    const ExtModule = defineModule({ serverConfig: { requestTimeoutMs: 99 } });
    const { activate } = createExtensionFromModule(ExtModule);
    const context = makeContext();

    await activate(context as never);

    expect(StdioServerProcessMock).toHaveBeenCalledWith(
      expect.objectContaining({ requestTimeoutMs: 99 }),
    );
    const server = StdioServerProcessMock.mock.results[0].value;
    expect(server.start).toHaveBeenCalledWith('/ext', 'dist/server.js');
    expect(createWebviewProvider).toHaveBeenCalledWith({ fsPath: '/ext' });
    expect(forRoot).toHaveBeenCalledWith({
      context,
      vscodeApi: vscodeMock,
      serverProcess: server,
      webviewProvider,
    });
    expect(createContext).toHaveBeenCalledWith(
      { module: ExtModule, imports: [forRoot.mock.results[0].value] },
      { logger: ['error', 'warn'] },
    );
    expect(vscodeMock.window.registerWebviewViewProvider).toHaveBeenCalledWith(
      'test.view',
      webviewProvider,
    );
    expect(vscodeMock.commands.registerCommand).toHaveBeenCalledWith(
      'ext.hello',
      expect.any(Function),
    );
    expect(vscodeMock.window.createOutputChannel).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('TestExt extension is now active');
    expect(log).toHaveBeenCalledWith(
      'ExtensionMessageBus initialized with 1 handlers',
    );
    expect(log).toHaveBeenCalledWith('Registered commands: ext.hello');
    expect(error).toHaveBeenCalledWith(
      'Failed to get command handler MissingCommands: no provider MissingCommands',
    );
    expect(context.subscriptions).toEqual([
      expect.objectContaining({ tag: 'webview-registration' }),
      expect.objectContaining({ id: 'ext.hello' }),
      { dispose: expect.any(Function) },
    ]);
  });

  it('closes the Nest app once via the cleanup subscription', async () => {
    const { activate } = createExtensionFromModule(defineModule());
    const context = makeContext();
    await activate(context as never);

    const cleanup = context.subscriptions[context.subscriptions.length - 1];
    await cleanup.dispose();
    await cleanup.dispose();

    expect(app.close).toHaveBeenCalledTimes(1);
  });

  it('logs when the ExtensionMessageBus is unavailable', async () => {
    app.get.mockImplementation(() => {
      throw new Error('missing');
    });
    const { activate } = createExtensionFromModule(
      defineModule({ commandHandlerTokens: [] }),
    );

    await activate(makeContext() as never);

    expect(log).toHaveBeenCalledWith(
      'ExtensionMessageBus not available - webview messages will not be routed',
    );
  });

  it('stringifies non-Error failures resolving command handlers', async () => {
    app.get.mockImplementation((token: unknown) => {
      if (token === ExtensionMessageBus) {
        return { getRegisteredHandlers: () => [] };
      }
      throw 'plain failure';
    });
    const { activate } = createExtensionFromModule(
      defineModule({ commandHandlerTokens: [Commands] }),
    );

    await activate(makeContext() as never);

    expect(error).toHaveBeenCalledWith(
      'Failed to get command handler Commands: plain failure',
    );
  });

  it('wires server callbacks to the logging hooks', async () => {
    const { activate } = createExtensionFromModule(defineModule());
    await activate(makeContext() as never);
    const opts = StdioServerProcessMock.mock.calls[0][0];

    opts.onStderr('stderr text');
    opts.onExit(3);
    opts.onError(new Error('spawn failed'));
    opts.onLog({ level: 'error', message: 'ignored', timestamp: 'x' });

    expect(error).toHaveBeenCalledWith('stderr text');
    expect(log).toHaveBeenCalledWith('Server process exited with code 3');
    expect(error).toHaveBeenCalledWith('Server process error: spawn failed');
    expect(outputChannel.appendLine).not.toHaveBeenCalled();
  });

  it('writes server logs to a configured output channel and shows it on error', async () => {
    const { activate } = createExtensionFromModule(
      defineModule({
        serverOutputChannel: { name: 'Test Server', showOnError: true },
      }),
    );
    const context = makeContext();
    await activate(context as never);
    const { onLog } = StdioServerProcessMock.mock.calls[0][0];
    const timestamp = '2026-01-02T03:04:05.000Z';
    const time = new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    expect(vscodeMock.window.createOutputChannel).toHaveBeenCalledWith(
      'Test Server',
    );
    expect(context.subscriptions[0]).toBe(outputChannel);

    onLog({ level: 'debug', message: 'd', timestamp });
    onLog({ level: 'info', message: 'i', timestamp });
    onLog({ level: 'warn', message: 'w', timestamp });
    expect(outputChannel.show).not.toHaveBeenCalled();
    onLog({ level: 'error', message: 'e', timestamp });

    expect(outputChannel.appendLine.mock.calls).toEqual([
      [`${time} [DEBUG] d`],
      [`${time} [INFO]  i`],
      [`${time} [WARN]  w`],
      [`${time} [ERROR] e`],
    ]);
    expect(outputChannel.show).toHaveBeenCalledWith(true);
  });

  it('does not show the output channel on error unless configured', async () => {
    const { activate } = createExtensionFromModule(
      defineModule({ serverOutputChannel: { name: 'Quiet' } }),
    );
    await activate(makeContext() as never);
    const { onLog } = StdioServerProcessMock.mock.calls[0][0];

    onLog({
      level: 'error',
      message: 'e',
      timestamp: new Date().toISOString(),
    });

    expect(outputChannel.appendLine).toHaveBeenCalled();
    expect(outputChannel.show).not.toHaveBeenCalled();
  });

  it('falls back to the raw timestamp when formatting throws', async () => {
    const { activate } = createExtensionFromModule(
      defineModule({ serverOutputChannel: { name: 'C' } }),
    );
    await activate(makeContext() as never);
    const { onLog } = StdioServerProcessMock.mock.calls[0][0];
    jest.spyOn(Date.prototype, 'toLocaleTimeString').mockImplementation(() => {
      throw new RangeError('bad');
    });

    onLog({ level: 'info', message: 'm', timestamp: 'raw' });

    expect(outputChannel.appendLine).toHaveBeenCalledWith('raw [INFO]  m');
  });

  it('logs and rethrows activation failures including the stack', async () => {
    const failure = new Error('bootstrap failed');
    createContext.mockRejectedValue(failure);
    const { activate } = createExtensionFromModule(defineModule());

    await expect(activate(makeContext() as never)).rejects.toBe(failure);

    expect(error).toHaveBeenCalledWith(
      'Failed to activate extension: bootstrap failed',
    );
    expect(error).toHaveBeenCalledWith(failure.stack);
  });

  it('logs non-Error activation failures without a stack', async () => {
    createContext.mockRejectedValue('weird');
    const { activate } = createExtensionFromModule(defineModule());

    await expect(activate(makeContext() as never)).rejects.toBe('weird');

    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith('Failed to activate extension: weird');
  });

  it('deactivate stops the server once and is safe before activation', async () => {
    const { activate, deactivate } = createExtensionFromModule(defineModule());
    expect(() => deactivate()).not.toThrow();

    await activate(makeContext() as never);
    const server = StdioServerProcessMock.mock.results[0].value;
    deactivate();
    deactivate();

    expect(server.stop).toHaveBeenCalledTimes(1);
  });

  it('defaults logging to the console', async () => {
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const { activate } = createExtensionFromModule(
      defineModule({
        logging: undefined,
        commandHandlerTokens: [MissingCommands],
      }),
    );

    await activate(makeContext() as never);

    expect(console.log).toHaveBeenCalledWith('TestExt extension is now active');
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to get command handler MissingCommands'),
    );
  });
});
