import { Injectable } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { WebviewHandler } from './decorators/webview-handler.decorator';
import { WebviewHandlerRegistry } from './webview-handler-registry';

@Injectable()
class FileHandlers {
  private readonly root = '/root';

  @WebviewHandler('extension.selectFile')
  selectFile(params: { name: string }) {
    return `${this.root}/${params.name}`;
  }

  notAHandler() {
    return 'nope';
  }
}

@Injectable()
class OtherHandlers {
  @WebviewHandler('extension.ping')
  ping() {
    return 'pong';
  }
}

@Injectable()
class DuplicateHandlers {
  @WebviewHandler('extension.ping')
  ping2() {
    return 'pong2';
  }
}

async function bootstrap(providers: Array<new (...a: never[]) => unknown>) {
  const moduleRef = await Test.createTestingModule({
    imports: [DiscoveryModule],
    providers: [
      WebviewHandlerRegistry,
      ...providers,
      { provide: 'VALUE', useValue: 5 },
    ],
  }).compile();
  return moduleRef;
}

describe(WebviewHandlerRegistry.name, () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('discovers decorated methods across providers on bootstrap', async () => {
    const moduleRef = await bootstrap([FileHandlers, OtherHandlers]);
    await moduleRef.init();
    const registry = moduleRef.get(WebviewHandlerRegistry);

    expect(registry.getRegisteredMethods().sort()).toEqual([
      'extension.ping',
      'extension.selectFile',
    ]);
    expect(registry.hasHandler('extension.ping')).toBe(true);
    expect(registry.hasHandler('notAHandler')).toBe(false);
    expect(registry.getHandler('missing')).toBeUndefined();
    expect(
      await registry.getHandler('extension.selectFile')!({ name: 'a.txt' }),
    ).toBe('/root/a.txt');
    await moduleRef.close();
  });

  it('throws when two providers handle the same method', async () => {
    const moduleRef = await bootstrap([OtherHandlers, DuplicateHandlers]);
    await expect(moduleRef.init()).rejects.toThrow(
      /Duplicate handler for method "extension.ping"/,
    );
  });

  it('supports manual registration and rejects duplicates', async () => {
    const moduleRef = await bootstrap([]);
    const registry = moduleRef.get(WebviewHandlerRegistry);
    const handler = jest.fn();

    registry.registerHandler('m', handler);

    expect(registry.getHandler('m')).toBe(handler);
    expect(() => registry.registerHandler('m', jest.fn())).toThrow(
      /Duplicate handler for method "m"/,
    );
  });

  it('skips wrappers without object instances', () => {
    const scanFromPrototype = jest.fn();
    const registry = new WebviewHandlerRegistry(
      {
        getProviders: () => [
          { instance: null },
          { instance: 'string' },
          { instance: Object.create(null) },
        ],
      } as never,
      { scanFromPrototype } as never,
    );

    registry.onApplicationBootstrap();

    expect(scanFromPrototype).not.toHaveBeenCalled();
    expect(registry.getRegisteredMethods()).toEqual([]);
  });

  it('ignores decorated names that are not functions on the instance and names unknown wrappers', () => {
    const instance = new OtherHandlers();
    Object.defineProperty(instance, 'ping', { value: 'shadow' });
    const registry = new WebviewHandlerRegistry(
      { getProviders: () => [{ instance }] } as never,
      {
        scanFromPrototype: (
          _i: unknown,
          _p: unknown,
          cb: (n: string) => void,
        ) => cb('ping'),
      } as never,
    );

    registry.onApplicationBootstrap();

    expect(registry.hasHandler('extension.ping')).toBe(false);
  });

  it('reports "unknown" when a duplicate comes from an unnamed wrapper', () => {
    const scan = (instance: object, _p: unknown, cb: (n: string) => void) =>
      cb(Object.getOwnPropertyNames(Object.getPrototypeOf(instance))[1]);
    const registry = new WebviewHandlerRegistry(
      {
        getProviders: () => [
          { instance: new OtherHandlers(), name: 'Other' },
          { instance: new DuplicateHandlers() },
        ],
      } as never,
      { scanFromPrototype: scan } as never,
    );

    expect(() => registry.onApplicationBootstrap()).toThrow(
      'Found duplicate in unknown.ping2',
    );
  });
});
