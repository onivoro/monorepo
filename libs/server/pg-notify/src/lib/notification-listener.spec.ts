import { Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import createPgSubscriber from 'pg-listen';
import type { DataSource } from 'typeorm';
import {
  NotificationListener,
  NotificationListenerConnection,
} from './notification-listener';

jest.mock('pg-listen', () => ({ __esModule: true, default: jest.fn() }));

type FakeSubscriber = ReturnType<typeof fakeSubscriber>;

function fakeSubscriber() {
  return {
    events: new EventEmitter(),
    notifications: new EventEmitter(),
    connect: jest.fn().mockResolvedValue(undefined),
    listenTo: jest.fn().mockResolvedValue(undefined),
    unlisten: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  };
}

class TestListener extends NotificationListener<{ id: string }> {
  received: { id: string }[] = [];

  onNotification(payload: { id: string }) {
    this.received.push(payload);
  }
}

const driverOptions = {
  url: 'postgres://u:p@db:5432/app',
  host: 'db',
  username: 'u',
  password: 'p',
  database: 'app',
  port: 5432,
  ssl: false,
  connectTimeoutMS: 1234,
  applicationName: 'api',
  poolSize: 7,
  extra: { keepAlive: true },
};

const dataSource = {
  driver: { options: driverOptions },
} as unknown as DataSource;

describe('NotificationListener', () => {
  let subscribers: FakeSubscriber[];
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  /** Lets queued promise callbacks (connect/listen/teardown) run. */
  const flush = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  };

  beforeEach(() => {
    jest.useFakeTimers();
    connection = dataSource;
    subscribers = [];
    jest.mocked(createPgSubscriber).mockReset();
    jest.mocked(createPgSubscriber).mockImplementation(() => {
      const subscriber = fakeSubscriber();
      subscribers.push(subscriber);
      return subscriber as any;
    });
    logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  let connection: NotificationListenerConnection = dataSource;

  async function started() {
    const listener = new TestListener('events', connection);
    await listener.onModuleInit();
    return listener;
  }

  describe('onModuleInit', () => {
    it('creates the subscriber from the typeorm postgres driver options', async () => {
      await started();

      expect(createPgSubscriber).toHaveBeenCalledWith(
        {
          connectionString: 'postgres://u:p@db:5432/app',
          host: 'db',
          user: 'u',
          password: 'p',
          database: 'app',
          port: 5432,
          ssl: false,
          connectionTimeoutMillis: 1234,
          application_name: 'api',
          max: 7,
          keepAlive: true,
        },
        // pg-listen makes no retries of its own, and hands payloads over unparsed
        { retryLimit: 1, parse: expect.any(Function) },
      );
      const [, options] = jest.mocked(createPgSubscriber).mock.calls[0];
      expect((options as any).parse('not json')).toBe('not json');
    });

    // LISTEN would quietly truncate a long channel and hear nothing
    it('rejects a channel postgres cannot carry, at construction', () => {
      expect(() => new TestListener('', dataSource)).toThrow('cannot be empty');
      expect(() => new TestListener('c'.repeat(64), dataSource)).toThrow(
        'Postgres allows at most 63',
      );
      expect(() => new TestListener('c'.repeat(64), 'postgres://db')).toThrow(
        'Postgres allows at most 63',
      );
      expect(() => new TestListener('c'.repeat(63), dataSource)).not.toThrow();
      expect(createPgSubscriber).not.toHaveBeenCalled();
    });

    it('lets driver extras override the retry timeout', async () => {
      const ds = {
        driver: { options: { ...driverOptions, extra: { retryTimeout: 5 } } },
      } as unknown as DataSource;

      await new TestListener('events', ds).onModuleInit();

      // pg-listen reads its retry settings from its second argument only
      const [config, options] = jest.mocked(createPgSubscriber).mock.calls[0];
      expect(options).toEqual({ retryTimeout: 5, parse: expect.any(Function) });
      expect(config).not.toHaveProperty('retryTimeout');
    });

    it('accepts a pg connection string instead of a DataSource', async () => {
      await new TestListener(
        'events',
        'postgres://u:p@db:5432/app',
      ).onModuleInit();

      expect(createPgSubscriber).toHaveBeenCalledWith(
        { connectionString: 'postgres://u:p@db:5432/app' },
        { retryLimit: 1, parse: expect.any(Function) },
      );
      expect(subscribers[0].listenTo).toHaveBeenCalledWith('events');
    });

    it('accepts a pg client config instead of a DataSource', async () => {
      const config = {
        host: 'db',
        user: 'u',
        password: 'p',
        database: 'app',
        ssl: { rejectUnauthorized: false },
      };

      await new TestListener('events', config).onModuleInit();

      expect(createPgSubscriber).toHaveBeenCalledWith(config, {
        retryLimit: 1,
        parse: expect.any(Function),
      });
    });

    it('moves pg-listen retry settings out of a pg config, without mutating it', async () => {
      const config = { host: 'db', retryTimeout: 9, retryLimit: 4 };

      await new TestListener('events', config).onModuleInit();

      expect(createPgSubscriber).toHaveBeenCalledWith(
        { host: 'db' },
        { retryTimeout: 9, retryLimit: 4, parse: expect.any(Function) },
      );
      expect(config).toEqual({ host: 'db', retryTimeout: 9, retryLimit: 4 });
    });

    it('keeps a 30s pg-listen retry window when only another retry setting is given', async () => {
      await new TestListener('events', {
        host: 'db',
        retryLimit: 1,
      }).onModuleInit();

      expect(createPgSubscriber).toHaveBeenCalledWith(
        { host: 'db' },
        { retryTimeout: 30_000, retryLimit: 1, parse: expect.any(Function) },
      );
    });

    it('connects, listens to the channel and logs', async () => {
      await started();
      const [subscriber] = subscribers;

      expect(subscriber.connect).toHaveBeenCalled();
      expect(subscriber.listenTo).toHaveBeenCalledWith('events');
      expect(logSpy).toHaveBeenCalledWith(
        'Listening to pg "events" notifications',
      );
    });

    it('registers the error handler before connecting', async () => {
      jest.mocked(createPgSubscriber).mockImplementation(() => {
        const subscriber = fakeSubscriber();
        subscriber.connect.mockImplementation(async () => {
          expect(subscriber.events.listenerCount('error')).toBe(1);
          subscriber.events.emit('error', new Error('early'));
        });
        subscribers.push(subscriber);
        return subscriber as any;
      });

      await started();

      expect(errorSpy).toHaveBeenCalledWith(
        'pg "events" notification client failed: early',
      );
    });

    it('delivers notifications on the channel to onNotification', async () => {
      const listener = await started();

      subscribers[0].notifications.emit('events', { id: '1' });
      subscribers[0].notifications.emit('other', { id: 'ignored' });

      expect(listener.received).toEqual([{ id: '1' }]);
    });

    it('fails the boot when the database is unreachable', async () => {
      jest.mocked(createPgSubscriber).mockImplementation(() => {
        const subscriber = fakeSubscriber();
        subscriber.connect.mockRejectedValue(new Error('ECONNREFUSED'));
        return subscriber as any;
      });

      await expect(
        new TestListener('events', dataSource).onModuleInit(),
      ).rejects.toThrow('ECONNREFUSED');
    });

    it('logs reconnect attempts', async () => {
      await started();

      subscribers[0].events.emit('reconnect', 3);

      expect(warnSpy).toHaveBeenCalledWith(
        'Reconnecting to pg "events" notifications (attempt 3)',
      );
    });
  });

  // the reconnect and teardown behaviour must not depend on how the
  // connection was described
  describe.each([
    ['a TypeORM DataSource', dataSource],
    ['a pg connection string', 'postgres://u:p@db:5432/app'],
    ['a pg client config', { host: 'db', user: 'u', database: 'app' }],
  ] as [string, NotificationListenerConnection][])('with %s', (_, conn) => {
    beforeEach(() => {
      connection = conn;
    });

    describe('onModuleDestroy', () => {
      it('removes the exact listener it added, unlistens and closes', async () => {
        const listener = await started();
        const [subscriber] = subscribers;

        await listener.onModuleDestroy();

        expect(subscriber.notifications.listenerCount('events')).toBe(0);
        expect(subscriber.unlisten).toHaveBeenCalledWith('events');
        expect(subscriber.close).toHaveBeenCalled();
        expect(logSpy).toHaveBeenCalledWith(
          'Unlistening to pg "events" notifications',
        );
      });

      it('swallows errors while closing a broken subscriber', async () => {
        const listener = await started();
        subscribers[0].unlisten.mockRejectedValue(new Error('dead'));

        await expect(listener.onModuleDestroy()).resolves.toBeUndefined();
      });

      it('is safe to call when never initialised', async () => {
        await expect(
          new TestListener('events', dataSource).onModuleDestroy(),
        ).resolves.toBeUndefined();
        expect(createPgSubscriber).not.toHaveBeenCalled();
      });

      it('cancels a pending re-initialisation', async () => {
        const listener = await started();
        subscribers[0].events.emit('error', new Error('gone'));

        await listener.onModuleDestroy();
        jest.advanceTimersByTime(60_000);
        await flush();

        expect(subscribers).toHaveLength(1);
      });

      it('ignores subscriber errors after shutdown', async () => {
        const listener = await started();
        const [subscriber] = subscribers;
        await listener.onModuleDestroy();

        subscriber.events.emit('error', new Error('late'));
        jest.advanceTimersByTime(60_000);
        await flush();

        expect(subscribers).toHaveLength(1);
      });
    });

    describe('when pg-listen gives up', () => {
      it('logs instead of crashing and re-initialises after 1s', async () => {
        const listener = await started();
        const [first] = subscribers;

        expect(() =>
          first.events.emit('error', new Error('timeout reached')),
        ).not.toThrow();
        expect(errorSpy).toHaveBeenCalledWith(
          'pg "events" notification client failed: timeout reached',
        );

        jest.advanceTimersByTime(999);
        await flush();
        expect(subscribers).toHaveLength(1);

        jest.advanceTimersByTime(1);
        await flush();

        expect(first.close).toHaveBeenCalled();
        expect(subscribers).toHaveLength(2);
        expect(subscribers[1].listenTo).toHaveBeenCalledWith('events');

        subscribers[1].notifications.emit('events', { id: 'after' });
        expect(listener.received).toEqual([{ id: 'after' }]);
      });

      it('never schedules two re-initialisations at once', async () => {
        await started();

        subscribers[0].events.emit('error', new Error('a'));
        subscribers[0].events.emit('error', new Error('b'));
        jest.advanceTimersByTime(1_000);
        await flush();

        expect(subscribers).toHaveLength(2);
      });

      it('backs off exponentially, capped at 30s, while re-initialisation keeps failing', async () => {
        await started();
        jest.mocked(createPgSubscriber).mockImplementation(() => {
          const subscriber = fakeSubscriber();
          subscriber.connect.mockRejectedValue(new Error('still down'));
          subscribers.push(subscriber);
          return subscriber as any;
        });

        subscribers[0].events.emit('error', new Error('gone'));

        const expectedDelays = [
          1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000,
        ];
        for (const [attempt, delay] of expectedDelays.entries()) {
          jest.advanceTimersByTime(delay - 1);
          await flush();
          expect(subscribers).toHaveLength(attempt + 1);

          jest.advanceTimersByTime(1);
          await flush();
          expect(subscribers).toHaveLength(attempt + 2);
        }

        expect(errorSpy).toHaveBeenCalledWith(
          'could not re-establish pg "events" notifications: still down',
        );
      });

      it('resets the backoff after a successful re-initialisation', async () => {
        await started();
        let failures = 2;
        jest.mocked(createPgSubscriber).mockImplementation(() => {
          const subscriber = fakeSubscriber();
          if (failures-- > 0)
            subscriber.connect.mockRejectedValue(new Error('down'));
          subscribers.push(subscriber);
          return subscriber as any;
        });

        subscribers[0].events.emit('error', new Error('gone'));
        jest.advanceTimersByTime(1_000); // attempt fails
        await flush();
        jest.advanceTimersByTime(2_000); // attempt fails
        await flush();
        jest.advanceTimersByTime(4_000); // attempt succeeds
        await flush();
        expect(subscribers).toHaveLength(4);

        subscribers[3].events.emit('error', new Error('gone again'));
        jest.advanceTimersByTime(1_000);
        await flush();

        expect(subscribers).toHaveLength(5);
      });
    });
  });

  describe('hooks and state', () => {
    class HookedListener extends NotificationListener<unknown> {
      received: unknown[] = [];
      events: string[] = [];
      listening: boolean[] = [];
      badPayloads: [string, Error][] = [];
      onListeningImpl: (e: { reconnected: boolean }) => void | Promise<void> =
        () => undefined;
      onConnectionLostImpl: (error: Error) => void = () => undefined;

      onNotification(payload: unknown) {
        this.received.push(payload);
      }

      protected override onListening(e: { reconnected: boolean }) {
        this.events.push(`listening reconnected=${e.reconnected}`);
        this.listening.push(this.isListening);
        return this.onListeningImpl(e);
      }

      protected override onConnectionLost(error: Error) {
        this.events.push(`lost ${error.message}`);
        this.listening.push(this.isListening);
        this.onConnectionLostImpl(error);
      }
    }

    async function hooked(conn: NotificationListenerConnection = dataSource) {
      const listener = new HookedListener('events', conn);
      await listener.onModuleInit();
      return listener;
    }

    it('reports the first LISTEN, and is listening', async () => {
      const listener = new HookedListener('events', dataSource);
      expect(listener.isListening).toBe(false);

      await listener.onModuleInit();

      expect(listener.events).toEqual(['listening reconnected=false']);
      expect(listener.isListening).toBe(true);
      expect(listener.listening).toEqual([true]);
    });

    it('reports a loss before retrying, then the LISTEN after it as a reconnect', async () => {
      const listener = await hooked();

      subscribers[0].events.emit('error', new Error('terminated'));

      expect(listener.events).toEqual([
        'listening reconnected=false',
        'lost terminated',
      ]);
      expect(listener.isListening).toBe(false);
      expect(subscribers).toHaveLength(1);

      jest.advanceTimersByTime(1_000);
      await flush();

      expect(subscribers).toHaveLength(2);
      expect(listener.events).toEqual([
        'listening reconnected=false',
        'lost terminated',
        'listening reconnected=true',
      ]);
      expect(listener.isListening).toBe(true);
      expect(logSpy).toHaveBeenCalledWith(
        'Listening to pg "events" notifications again',
      );
    });

    it('reports one loss however many errors follow it', async () => {
      const listener = await hooked();
      jest.mocked(createPgSubscriber).mockImplementation(() => {
        const subscriber = fakeSubscriber();
        subscriber.connect.mockRejectedValue(new Error('still down'));
        subscribers.push(subscriber);
        return subscriber as any;
      });

      subscribers[0].events.emit('error', new Error('a'));
      subscribers[0].events.emit('error', new Error('b'));
      jest.advanceTimersByTime(1_000);
      await flush();
      jest.advanceTimersByTime(2_000);
      await flush();

      expect(listener.events.filter((e) => e.startsWith('lost'))).toEqual([
        'lost a',
      ]);
      expect(listener.isListening).toBe(false);
    });

    it('logs what onListening throws or rejects with, and keeps listening', async () => {
      const listener = new HookedListener('events', dataSource);
      listener.onListeningImpl = () => {
        throw new Error('resync failed');
      };
      await listener.onModuleInit();

      expect(errorSpy).toHaveBeenCalledWith(
        'onListening failed for pg "events" notifications: resync failed',
      );
      expect(listener.isListening).toBe(true);

      listener.onListeningImpl = () => Promise.reject(new Error('async'));
      subscribers[0].events.emit('error', new Error('gone'));
      jest.advanceTimersByTime(1_000);
      await flush();

      expect(errorSpy).toHaveBeenCalledWith(
        'onListening failed for pg "events" notifications: async',
      );
      expect(listener.isListening).toBe(true);
    });

    it('logs what onConnectionLost throws, and still retries', async () => {
      const listener = await hooked();
      listener.onConnectionLostImpl = () => {
        throw new Error('oops');
      };

      expect(() =>
        subscribers[0].events.emit('error', new Error('gone')),
      ).not.toThrow();
      expect(errorSpy).toHaveBeenCalledWith(
        'onConnectionLost failed for pg "events" notifications: oops',
      );

      jest.advanceTimersByTime(1_000);
      await flush();
      expect(subscribers).toHaveLength(2);
      expect(listener.isListening).toBe(true);
    });

    describe('when pg-listen is asked to retry itself', () => {
      const retrying = { host: 'db', retryTimeout: 10_000 };

      beforeEach(() => {
        // As pg-listen does: `connected` from connect(), before the LISTEN.
        jest.mocked(createPgSubscriber).mockImplementation(() => {
          const subscriber = fakeSubscriber();
          subscriber.connect.mockImplementation(async () => {
            subscriber.events.emit('connected');
          });
          subscribers.push(subscriber);
          return subscriber as any;
        });
      });

      it('reports its reconnect as a loss, and its re-LISTEN as a reconnect', async () => {
        const listener = await hooked(retrying);
        expect(listener.events).toEqual(['listening reconnected=false']);

        subscribers[0].events.emit('reconnect', 1);
        subscribers[0].events.emit('reconnect', 2);
        expect(listener.isListening).toBe(false);

        subscribers[0].events.emit('connected');

        expect(listener.events).toEqual([
          'listening reconnected=false',
          'lost the connection was lost; pg-listen is reconnecting',
          'listening reconnected=true',
        ]);
        expect(listener.isListening).toBe(true);
        expect(subscribers).toHaveLength(1);
      });

      it('closes a connection pg-listen makes after the listener was closed', async () => {
        const listener = await hooked(retrying);
        const [subscriber] = subscribers;
        subscriber.events.emit('reconnect', 1);
        await listener.onModuleDestroy();
        subscriber.close.mockClear();

        subscriber.events.emit('connected');

        expect(subscriber.close).toHaveBeenCalled();
        expect(listener.events).toEqual([
          'listening reconnected=false',
          'lost the connection was lost; pg-listen is reconnecting',
        ]);
      });
    });
  });

  describe('payloads', () => {
    class RawListener extends NotificationListener<unknown> {
      received: unknown[] = [];
      onNotificationImpl: (payload: unknown) => void | Promise<void> = (p) => {
        this.received.push(p);
      };

      onNotification(payload: unknown) {
        return this.onNotificationImpl(payload);
      }
    }

    async function raw(options = {}) {
      const listener = new RawListener('events', dataSource, options);
      await listener.onModuleInit();
      return listener;
    }

    it('parses each payload as JSON', async () => {
      const listener = await raw();

      subscribers[0].notifications.emit('events', '{"id":"1"}');
      subscribers[0].notifications.emit('events', '42');

      expect(listener.received).toEqual([{ id: '1' }, 42]);
    });

    it('hands a notification without a payload over as undefined', async () => {
      const listener = await raw();

      subscribers[0].notifications.emit('events', undefined);

      expect(listener.received).toEqual([undefined]);
    });

    it('skips a payload that is not JSON, warns without it, and keeps the connection', async () => {
      const listener = await raw();
      const [subscriber] = subscribers;

      expect(() =>
        subscriber.notifications.emit('events', 'secret not json'),
      ).not.toThrow();
      subscriber.notifications.emit('events', '{"id":"after"}');
      jest.advanceTimersByTime(60_000);
      await flush();

      expect(listener.received).toEqual([{ id: 'after' }]);
      expect(warnSpy).toHaveBeenCalledWith(
        'Ignored a pg "events" notification whose payload (15 characters) could not be parsed',
      );
      expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('secret');
      expect(subscriber.close).not.toHaveBeenCalled();
      expect(subscribers).toHaveLength(1);
      expect(listener.isListening).toBe(true);
    });

    it('gives onBadPayload the raw payload and the error', async () => {
      const seen: [string, string][] = [];
      class Strict extends RawListener {
        protected override onBadPayload(rawPayload: string, error: Error) {
          seen.push([rawPayload, error.name]);
        }
      }
      const listener = new Strict('events', dataSource);
      await listener.onModuleInit();

      subscribers[0].notifications.emit('events', '{');

      expect(seen).toEqual([['{', 'SyntaxError']]);
      expect(listener.received).toEqual([]);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('logs what onBadPayload throws', async () => {
      class Throwing extends RawListener {
        protected override onBadPayload() {
          throw new Error('bad hook');
        }
      }
      const listener = new Throwing('events', dataSource);
      await listener.onModuleInit();

      expect(() =>
        subscribers[0].notifications.emit('events', '{'),
      ).not.toThrow();
      expect(errorSpy).toHaveBeenCalledWith(
        'onBadPayload failed for pg "events" notifications: bad hook',
      );
    });

    it('uses the parse option instead of JSON', async () => {
      const listener = await raw({
        parse: (s: string) => {
          if (!s.startsWith('v1:')) throw new Error('unknown version');
          return s.slice(3);
        },
      });

      subscribers[0].notifications.emit('events', 'v1:hello');
      subscribers[0].notifications.emit('events', '{"id":"1"}');

      expect(listener.received).toEqual(['hello']);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('logs what onNotification throws or rejects with, without the payload', async () => {
      const listener = await raw();
      listener.onNotificationImpl = (p: any) => {
        if (p.sync) throw new Error('sync failure');
        return Promise.reject(new Error('async failure'));
      };

      expect(() =>
        subscribers[0].notifications.emit('events', '{"sync":true}'),
      ).not.toThrow();
      subscribers[0].notifications.emit('events', '{"sync":false}');
      await flush();

      expect(errorSpy).toHaveBeenCalledWith(
        'A pg "events" notification failed: sync failure',
      );
      expect(errorSpy).toHaveBeenCalledWith(
        'A pg "events" notification failed: async failure',
      );
      expect(subscribers).toHaveLength(1);
    });
  });

  describe('closing', () => {
    function deferred() {
      let resolve!: () => void;
      let reject!: (error: Error) => void;
      const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    }

    it('stops retrying once closed, even mid-subscribe, and waits for that subscribe', async () => {
      const listener = await started();
      const connecting = deferred();
      jest.mocked(createPgSubscriber).mockImplementation(() => {
        const subscriber = fakeSubscriber();
        subscriber.connect.mockReturnValue(connecting.promise);
        // Closing the connection is what makes a pending connect fail.
        subscriber.close.mockImplementation(async () => {
          connecting.reject(new Error('Connection terminated'));
        });
        subscribers.push(subscriber);
        return subscriber as any;
      });

      subscribers[0].events.emit('error', new Error('gone'));
      jest.advanceTimersByTime(1_000);
      await flush();
      expect(subscribers).toHaveLength(2);
      const inFlight = subscribers[1];

      await listener.onModuleDestroy();

      expect(inFlight.close).toHaveBeenCalled();
      expect(inFlight.listenTo).not.toHaveBeenCalled();
      jest.advanceTimersByTime(120_000);
      await flush();
      expect(subscribers).toHaveLength(2);
      expect(listener.isListening).toBe(false);
      expect(errorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('could not re-establish'),
      );
    });

    it('does not LISTEN on a connection that completes after closing', async () => {
      const connecting = deferred();
      jest.mocked(createPgSubscriber).mockImplementation(() => {
        const subscriber = fakeSubscriber();
        subscriber.connect.mockReturnValue(connecting.promise);
        subscribers.push(subscriber);
        return subscriber as any;
      });
      const listener = new TestListener('events', dataSource);
      const init = listener.onModuleInit();
      await flush();

      const destroyed = listener.onModuleDestroy();
      connecting.resolve();

      await expect(init).rejects.toThrow('closed while connecting');
      await destroyed;
      expect(subscribers[0].listenTo).not.toHaveBeenCalled();
      expect(subscribers[0].close).toHaveBeenCalled();
      expect(listener.isListening).toBe(false);
    });

    it('leaves nothing behind when the boot fails', async () => {
      jest.mocked(createPgSubscriber).mockImplementation(() => {
        const subscriber = fakeSubscriber();
        subscriber.connect.mockImplementation(async () => {
          subscriber.events.emit('error', new Error('refused'));
          throw new Error('ECONNREFUSED');
        });
        subscribers.push(subscriber);
        return subscriber as any;
      });

      await expect(
        new TestListener('events', dataSource).onModuleInit(),
      ).rejects.toThrow('ECONNREFUSED');

      expect(subscribers[0].close).toHaveBeenCalled();
      jest.advanceTimersByTime(120_000);
      await flush();
      expect(subscribers).toHaveLength(1);
    });
  });

  describe('logger option', () => {
    it('logs to the given logger', async () => {
      const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
      const listener = new TestListener('events', dataSource, { logger });
      await listener.onModuleInit();
      subscribers[0].events.emit('error', new Error('gone'));

      expect(logger.log).toHaveBeenCalledWith(
        'Listening to pg "events" notifications',
      );
      expect(logger.error).toHaveBeenCalledWith(
        'pg "events" notification client failed: gone',
      );
      expect(logSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
      await listener.onModuleDestroy();
    });

    it('logs nothing with false', async () => {
      const listener = new TestListener('events', dataSource, {
        logger: false,
      });
      await listener.onModuleInit();
      subscribers[0].events.emit('error', new Error('gone'));
      subscribers[0].notifications.emit('events', 'not json');
      await listener.onModuleDestroy();

      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });
});
