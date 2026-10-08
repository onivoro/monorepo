import { Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import createPgSubscriber from 'pg-listen';
import type { DataSource } from 'typeorm';
import { NotificationListener } from './notification-listener';

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

  async function started() {
    const listener = new TestListener('events', dataSource);
    await listener.onModuleInit();
    return listener;
  }

  describe('onModuleInit', () => {
    it('creates the subscriber from the typeorm postgres driver options', async () => {
      await started();

      expect(createPgSubscriber).toHaveBeenCalledWith({
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
        retryTimeout: 30_000,
        keepAlive: true,
      });
    });

    it('lets driver extras override the retry timeout', async () => {
      const ds = {
        driver: { options: { ...driverOptions, extra: { retryTimeout: 5 } } },
      } as unknown as DataSource;

      await new TestListener('events', ds).onModuleInit();

      expect(jest.mocked(createPgSubscriber).mock.calls[0][0]).toEqual(
        expect.objectContaining({ retryTimeout: 5 }),
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
