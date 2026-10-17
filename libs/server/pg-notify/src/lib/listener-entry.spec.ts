import { EventEmitter } from 'events';

// @nestjs/common is installed here. The /listener entry point must still never load it: not
// at import, and not for a listener constructed without a logger.
let mockNestLoaded = false;
jest.mock('@nestjs/common', () => {
  mockNestLoaded = true;
  return jest.requireActual('@nestjs/common');
});
jest.mock('pg-listen', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    events: new EventEmitter(),
    notifications: new EventEmitter(),
    connect: jest.fn().mockResolvedValue(undefined),
    listenTo: jest.fn().mockResolvedValue(undefined),
    unlisten: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('the /listener entry point, with @nestjs/common installed', () => {
  afterEach(() => jest.restoreAllMocks());

  it('never loads @nestjs/common', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const lib = await import('../listener');

    class Listener extends lib.NotificationListener<unknown> {
      onNotification() {
        return undefined;
      }
    }
    const listener = new Listener('events', 'postgres://localhost/app');
    await listener.onModuleInit();
    await listener.onModuleDestroy();

    expect(mockNestLoaded).toBe(false);
  });

  it('while the main entry point does, for its Nest logger', async () => {
    await import('../index');
    expect(mockNestLoaded).toBe(true);
  });
});
