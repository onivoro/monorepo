import { Injectable } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ServerNotificationHandler } from './decorators/server-notification-handler.decorator';
import { ServerNotificationHandlerRegistry } from './server-notification-handler-registry';
import {
  STDIO_SERVER_PROCESS,
  WEBVIEW_PROVIDER,
} from './vscode-module/vscode-injection-tokens';

type Listener = (params: unknown) => Promise<void>;

function fakeServer() {
  const listeners = new Map<string, Listener>();
  const unsubscribes = new Map<string, jest.Mock>();
  return {
    listeners,
    unsubscribes,
    onNotification: jest.fn((method: string, cb: Listener) => {
      listeners.set(method, cb);
      const unsub = jest.fn();
      unsubscribes.set(method, unsub);
      return unsub;
    }),
  };
}

@Injectable()
class Notes {
  readonly received: unknown[] = [];

  @ServerNotificationHandler('progress')
  onProgress(params: unknown) {
    this.received.push(params);
  }

  @ServerNotificationHandler('explode')
  onExplode() {
    throw new Error('handler failed');
  }
}

@Injectable()
class DuplicateNotes {
  @ServerNotificationHandler('progress')
  again() {}
}

describe(ServerNotificationHandlerRegistry.name, () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  async function bootstrap(
    providers: Array<new (...a: never[]) => unknown>,
    webviewProvider?: { postMessage: jest.Mock },
  ) {
    const server = fakeServer();
    const moduleRef = await Test.createTestingModule({
      imports: [DiscoveryModule],
      providers: [
        ServerNotificationHandlerRegistry,
        ...providers,
        { provide: STDIO_SERVER_PROCESS, useValue: server },
        ...(webviewProvider
          ? [{ provide: WEBVIEW_PROVIDER, useValue: webviewProvider }]
          : []),
      ],
    }).compile();
    return { moduleRef, server };
  }

  it('discovers handlers, subscribes to the server and forwards to the webview', async () => {
    const webview = { postMessage: jest.fn() };
    const { moduleRef, server } = await bootstrap([Notes], webview);
    await moduleRef.init();
    const registry = moduleRef.get(ServerNotificationHandlerRegistry);
    const notes = moduleRef.get(Notes);

    expect(registry.getRegisteredMethods().sort()).toEqual([
      'explode',
      'progress',
    ]);
    expect(registry.hasHandler('progress')).toBe(true);
    expect(typeof registry.getHandler('progress')).toBe('function');
    expect(server.onNotification).toHaveBeenCalledTimes(2);

    await server.listeners.get('progress')!({ pct: 50 });

    expect(notes.received).toEqual([{ pct: 50 }]);
    expect(webview.postMessage).toHaveBeenCalledWith({
      jsonrpc: '2.0',
      method: 'progress',
      params: { pct: 50 },
    });
  });

  it('logs handler errors and still forwards to the webview', async () => {
    const webview = { postMessage: jest.fn() };
    const { moduleRef, server } = await bootstrap([Notes], webview);
    await moduleRef.init();

    await server.listeners.get('explode')!({ x: 1 });

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Error in handler for "explode"'),
      expect.any(Error),
    );
    expect(webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'explode' }),
    );
  });

  it('works without a webview provider', async () => {
    const { moduleRef, server } = await bootstrap([Notes]);
    await moduleRef.init();
    const notes = moduleRef.get(Notes);

    await expect(
      server.listeners.get('progress')!({ pct: 1 }),
    ).resolves.toBeUndefined();
    expect(notes.received).toEqual([{ pct: 1 }]);
  });

  it('skips dispatch when the handler was removed after subscription', async () => {
    const webview = { postMessage: jest.fn() };
    const { moduleRef, server } = await bootstrap([Notes], webview);
    await moduleRef.init();
    const registry = moduleRef.get(ServerNotificationHandlerRegistry);
    const listener = server.listeners.get('progress')!;

    registry.onModuleDestroy();
    await listener({ pct: 2 });

    expect(moduleRef.get(Notes).received).toEqual([]);
    expect(webview.postMessage).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes and clears on module destroy', async () => {
    const { moduleRef, server } = await bootstrap([Notes]);
    await moduleRef.init();
    const registry = moduleRef.get(ServerNotificationHandlerRegistry);

    await moduleRef.close();

    for (const unsub of server.unsubscribes.values()) {
      expect(unsub).toHaveBeenCalledTimes(1);
    }
    expect(registry.getRegisteredMethods()).toEqual([]);
  });

  it('throws on duplicate decorated handlers', async () => {
    const { moduleRef } = await bootstrap([Notes, DuplicateNotes]);
    await expect(moduleRef.init()).rejects.toThrow(
      /Duplicate handler for method "progress"/,
    );
  });

  it('supports manual registration and rejects duplicates', async () => {
    const { moduleRef } = await bootstrap([]);
    const registry = moduleRef.get(ServerNotificationHandlerRegistry);
    const handler = jest.fn();

    registry.registerHandler('m', handler);

    expect(registry.getHandler('m')).toBe(handler);
    expect(() => registry.registerHandler('m', jest.fn())).toThrow(
      /Duplicate handler for method "m"/,
    );
  });

  it('skips non-object instances, prototype-less objects and shadowed methods', () => {
    const server = fakeServer();
    const shadowed = new Notes();
    Object.defineProperty(shadowed, 'onProgress', { value: 1 });
    const registry = new ServerNotificationHandlerRegistry(
      {
        getProviders: () => [
          { instance: undefined },
          { instance: 3 },
          { instance: Object.create(null) },
          { instance: shadowed },
        ],
      } as never,
      {
        scanFromPrototype: (
          _i: unknown,
          _p: unknown,
          cb: (n: string) => void,
        ) => cb('onProgress'),
      } as never,
      server as never,
    );

    registry.onApplicationBootstrap();

    expect(registry.getRegisteredMethods()).toEqual([]);
    expect(server.onNotification).not.toHaveBeenCalled();
  });

  it('reports "unknown" for duplicates from unnamed wrappers', () => {
    const registry = new ServerNotificationHandlerRegistry(
      {
        getProviders: () => [
          { instance: new Notes(), name: 'Notes' },
          { instance: new DuplicateNotes() },
        ],
      } as never,
      {
        scanFromPrototype: (i: object, _p: unknown, cb: (n: string) => void) =>
          cb(i instanceof Notes ? 'onProgress' : 'again'),
      } as never,
      fakeServer() as never,
    );

    expect(() => registry.onApplicationBootstrap()).toThrow(
      'Found duplicate in unknown.again',
    );
  });
});
