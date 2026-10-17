import { EventEmitter } from 'events';

// @nestjs/common is an optional peer for the /listener entry point: the listener and the
// in-transaction helpers load and work without it (and without typeorm), logging to console.
jest.mock('@nestjs/common', () => {
  throw new Error("Cannot find module '@nestjs/common'");
});
jest.mock('typeorm', () => {
  throw new Error("Cannot find module 'typeorm'");
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

describe('without @nestjs/common installed', () => {
  afterEach(() => jest.restoreAllMocks());

  it('really cannot load @nestjs/common here', () => {
    expect(() => require('@nestjs/common')).toThrow('@nestjs/common');
  });

  it('listens through the /listener entry point, logging to console', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const lib = await import('../listener');
    const pgListen = (await import('pg-listen')).default as jest.Mock;

    const received: unknown[] = [];
    class Listener extends lib.NotificationListener<{ id: string }> {
      onNotification(payload: { id: string }) {
        received.push(payload);
      }
    }

    const listener = new Listener('events', 'postgres://localhost/app');
    await listener.onModuleInit();
    const subscriber = pgListen.mock.results[0].value;
    subscriber.notifications.emit('events', '{"id":"1"}');
    subscriber.notifications.emit('events', 'nope');
    await listener.onModuleDestroy();

    expect(received).toEqual([{ id: '1' }]);
    expect(log).toHaveBeenCalledWith(
      '[NotificationListener] Listening to pg "events" notifications',
    );
    expect(warn).toHaveBeenCalledWith(
      '[NotificationListener] Ignored a pg "events" notification whose payload (4 characters) could not be parsed',
    );
  });

  it('builds an in-transaction notify through the /listener entry point', async () => {
    const lib = await import('../listener');
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    await expect(lib.notifyInTransaction(client, 'events', '{}')).resolves.toBe(
      true,
    );
    expect(lib.buildNotifyQuery('events', 'x')).toMatchObject({
      text: 'SELECT pg_notify($1, $2)',
      values: ['events', 'x'],
    });
  });
});
