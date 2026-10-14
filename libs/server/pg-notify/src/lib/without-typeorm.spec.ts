import { EventEmitter } from 'events';

// typeorm is an optional peer: everything that does not take a DataSource has
// to load and work without it installed
jest.mock('typeorm', () => {
  throw new Error("Cannot find module 'typeorm'");
});
jest.mock('typeorm/driver/postgres/PostgresDriver', () => {
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

describe('without typeorm installed', () => {
  it('really cannot load typeorm here', () => {
    expect(() => require('typeorm')).toThrow('typeorm');
  });

  it('loads the package and listens with a pg connection string', async () => {
    const lib = await import('../index');

    class Listener extends lib.NotificationListener<unknown> {
      onNotification() {
        return undefined;
      }
    }

    const listener = new Listener('events', 'postgres://localhost/app');
    await listener.onModuleInit();
    await listener.onModuleDestroy();
  });

  it('publishes in a transaction and builds trigger sql', async () => {
    const lib = await import('../index');
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    await expect(lib.notifyInTransaction(client, 'events', '{}')).resolves.toBe(
      true,
    );
    expect(
      lib.buildNotifyTriggerSql({
        table: 'outbox',
        channel: 'c',
        columns: ['id'],
      }),
    ).toContain('CREATE TRIGGER');
  });

  it('publishes through a pg pool passed to PgNotifyPublisher', async () => {
    const lib = await import('../index');
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    await new lib.PgNotifyPublisher(pool).publish('events', 'hello');

    expect(pool.query).toHaveBeenCalledWith('SELECT pg_notify($1, $2)', [
      'events',
      'hello',
    ]);
  });
});
