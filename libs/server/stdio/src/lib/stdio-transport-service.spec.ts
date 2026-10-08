import { EventEmitter } from 'events';
import * as readline from 'readline';
import { Injectable } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { StdioHandler } from './stdio-handler';
import { StdioTransportModule } from './stdio-transport-module';
import { StdioTransportService } from './stdio-transport-service';

jest.mock('readline', () => ({ createInterface: jest.fn() }));

@Injectable()
class HealthHandlers {
  readonly status = 'ok';

  @StdioHandler('health')
  async health() {
    return { status: this.status };
  }

  @StdioHandler('echo')
  async echo(params: unknown) {
    return params;
  }

  async notAHandler() {
    return 'nope';
  }
}

@Injectable()
class PlainService {
  value = 1;
}

describe('StdioTransportService', () => {
  let rl: EventEmitter & { close: jest.Mock };
  let write: jest.SpyInstance;
  let log: jest.SpyInstance;
  let moduleRef: TestingModule;
  let service: StdioTransportService;

  const flush = () => new Promise((resolve) => setImmediate(resolve));

  beforeEach(async () => {
    rl = Object.assign(new EventEmitter(), { close: jest.fn() });
    (readline.createInterface as jest.Mock).mockReturnValue(rl);
    write = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    log = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    moduleRef = await Test.createTestingModule({
      imports: [StdioTransportModule.forRoot({ handlers: [HealthHandlers] })],
      providers: [PlainService, { provide: 'VALUE', useValue: 42 }],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(StdioTransportService);
  });

  afterEach(async () => {
    await moduleRef.close();
    write.mockRestore();
    log.mockRestore();
  });

  it('discovers @StdioHandler methods on module init', () => {
    expect(service.getTransport().getRegisteredMethods().sort()).toEqual([
      'echo',
      'health',
    ]);
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/^\[StdioTransport\] Registered 2 handlers: /),
    );
  });

  it('binds discovered handlers to their instance', async () => {
    rl.emit(
      'line',
      JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'health' }),
    );
    await flush();

    expect(JSON.parse(write.mock.calls[0][0] as string)).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: { status: 'ok' },
    });
  });

  it('registers handlers manually', async () => {
    service.registerHandler('manual', async (p: { n: number }) => p.n * 2);

    rl.emit(
      'line',
      JSON.stringify({
        jsonrpc: '2.0',
        id: 'm',
        method: 'manual',
        params: { n: 21 },
      }),
    );
    await flush();

    expect(JSON.parse(write.mock.calls[0][0] as string)).toEqual({
      jsonrpc: '2.0',
      id: 'm',
      result: 42,
    });
  });

  it('writes notifications to stdout as line-delimited JSON-RPC', () => {
    service.sendNotification('file.changed', { path: '/a' });

    expect(write).toHaveBeenCalledWith(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'file.changed',
        params: { path: '/a' },
      }) + '\n',
    );
  });

  it('closes the transport on module destroy', async () => {
    await moduleRef.close();
    expect(rl.close).toHaveBeenCalledTimes(1);
    // recreate so afterEach can close again harmlessly
    moduleRef = await Test.createTestingModule({}).compile();
  });

  it('skips providers without an object instance or prototype', () => {
    const transportOn = jest.fn();
    const scanner = { scanFromPrototype: jest.fn() };
    const bare = new StdioTransportService(
      {} as never,
      {
        getProviders: () => [
          { instance: undefined },
          { instance: 42 },
          { instance: Object.create(null) },
        ],
      } as never,
      scanner as never,
    );
    (bare.getTransport() as unknown as { on: jest.Mock }).on = transportOn;

    bare.onModuleInit();

    expect(scanner.scanFromPrototype).not.toHaveBeenCalled();
    expect(transportOn).not.toHaveBeenCalled();
    bare.onModuleDestroy();
  });
});
