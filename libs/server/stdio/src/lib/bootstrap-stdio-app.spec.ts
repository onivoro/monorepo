import { NestFactory } from '@nestjs/core';
import { bootstrapStdioApp } from './bootstrap-stdio-app';
import { patchConsoleForStdio } from './patch-console-for-stdio';
import { StdioTransportService } from './stdio-transport-service';

jest.mock('./patch-console-for-stdio', () => ({
  patchConsoleForStdio: jest.fn(),
}));

class AppModule {}

describe('bootstrapStdioApp', () => {
  let app: {
    useLogger: jest.Mock;
    flushLogs: jest.Mock;
    init: jest.Mock;
    get: jest.Mock;
    close: jest.Mock;
  };
  let create: jest.SpyInstance;
  let processOn: jest.SpyInstance;
  let exit: jest.SpyInstance;
  let log: jest.SpyInstance;
  let warn: jest.SpyInstance;

  const signalHandler = (signal: string) =>
    processOn.mock.calls.find(([event]) => event === signal)?.[1] as () => void;

  beforeEach(() => {
    const transportService = {
      getTransport: () => ({ getRegisteredMethods: () => ['a', 'b'] }),
    };
    app = {
      useLogger: jest.fn(),
      flushLogs: jest.fn(),
      init: jest.fn().mockResolvedValue(undefined),
      get: jest.fn((token) => {
        if (token === StdioTransportService) return transportService;
        throw new Error('not found');
      }),
      close: jest.fn().mockResolvedValue(undefined),
    };
    create = jest
      .spyOn(NestFactory, 'createApplicationContext')
      .mockResolvedValue(app as never);
    processOn = jest
      .spyOn(process, 'on')
      .mockImplementation(() => process as never);
    exit = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never);
    log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    (patchConsoleForStdio as jest.Mock).mockClear();
  });

  it('patches the console, creates and initialises the app context', async () => {
    await bootstrapStdioApp(AppModule);

    expect(patchConsoleForStdio).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(AppModule, { bufferLogs: true });
    expect(app.useLogger).toHaveBeenCalledWith(console);
    expect(app.flushLogs).toHaveBeenCalled();
    expect(app.init).toHaveBeenCalled();
    expect(
      (patchConsoleForStdio as jest.Mock).mock.invocationCallOrder[0],
    ).toBeLessThan(create.mock.invocationCallOrder[0]);
  });

  it('reports the number of registered handlers', async () => {
    await bootstrapStdioApp(AppModule);

    expect(log).toHaveBeenCalledWith(
      '[StdioApp] Ready with 2 registered handlers',
    );
    expect(log).toHaveBeenCalledWith('[StdioApp] Stdio server started');
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns when StdioTransportModule was not imported', async () => {
    app.get.mockImplementation(() => {
      throw new Error('not found');
    });

    await bootstrapStdioApp(AppModule);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('StdioTransportService not found'),
    );
    expect(log).toHaveBeenCalledWith('[StdioApp] Stdio server started');
  });

  it('uses the given logger', async () => {
    const logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };

    await bootstrapStdioApp(AppModule, { logger });

    expect(app.useLogger).toHaveBeenCalledWith(logger);
  });

  it('passes false through to disable logging', async () => {
    await bootstrapStdioApp(AppModule, { logger: false });

    expect(app.useLogger).toHaveBeenCalledWith(false);
  });

  it('awaits onReady with the app after init', async () => {
    const order: string[] = [];
    app.init.mockImplementation(async () => {
      order.push('init');
    });
    const onReady = jest.fn(async () => {
      order.push('ready');
    });

    await bootstrapStdioApp(AppModule, { onReady });

    expect(onReady).toHaveBeenCalledWith(app);
    expect(order).toEqual(['init', 'ready']);
  });

  it('propagates an onReady failure', async () => {
    await expect(
      bootstrapStdioApp(AppModule, {
        onReady: () => Promise.reject(new Error('not ready')),
      }),
    ).rejects.toThrow('not ready');
  });

  it.each(['SIGINT', 'SIGTERM'])(
    'closes the app and exits cleanly on %s',
    async (signal) => {
      await bootstrapStdioApp(AppModule);

      signalHandler(signal)();
      await new Promise((resolve) => setImmediate(resolve));

      expect(log).toHaveBeenCalledWith(
        `[StdioApp] Received ${signal}, shutting down...`,
      );
      expect(app.close).toHaveBeenCalledTimes(1);
      expect(exit).toHaveBeenCalledWith(0);
      expect(app.close.mock.invocationCallOrder[0]).toBeLessThan(
        exit.mock.invocationCallOrder[0],
      );
    },
  );
});
