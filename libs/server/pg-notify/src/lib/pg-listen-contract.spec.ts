import { EventEmitter } from 'events';
import createPgSubscriber from 'pg-listen';
import { NotificationListener } from './notification-listener';

// The real pg-listen over a stubbed pg.Client. NotificationListener depends on four things
// pg-listen 1.7 does, which this pins, so a pg-listen release that changes one fails here:
// - retryLimit: 1 makes no reconnect attempt of its own, and reports the loss as `error`
// - `parse` is only called for a non-empty payload
// - connect() emits `connected` before the LISTEN
// - with retries, a reconnect emits `reconnect` per attempt, re-runs the LISTEN, then
//   emits `connected`

const mockClients: MockPgClient[] = [];
/** Closed after each test, even a failing one: pg-listen's paranoid check is an interval. */
const cleanups: (() => Promise<unknown>)[] = [];

class MockPgClient extends EventEmitter {
  queries: string[] = [];
  ended = false;
  failConnect = false;

  constructor(readonly config: unknown) {
    super();
    mockClients.push(this);
  }

  async connect() {
    if (this.failConnect) throw new Error('ECONNREFUSED');
    this.emit('connect');
  }

  async query(text: string) {
    this.queries.push(text);
    return { rows: [] };
  }

  async end() {
    this.ended = true;
    this.emit('end');
  }

  notify(channel: string, payload: string) {
    this.emit('notification', { channel, payload, processId: 1 });
  }
}

// pg-listen loads pg when it is imported, before this class exists, and reads pg.Client
// only when it connects.
jest.mock('pg', () => ({
  get Client() {
    return MockPgClient;
  },
}));

const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

class Recorder extends NotificationListener<unknown> {
  events: string[] = [];
  received: unknown[] = [];

  onNotification(payload: unknown) {
    this.received.push(payload);
  }

  protected override onListening(e: { reconnected: boolean }) {
    this.events.push(`listening:${e.reconnected}`);
  }

  protected override onConnectionLost() {
    this.events.push('lost');
  }

  protected override onBadPayload(raw: string) {
    this.events.push(`bad:${raw}`);
  }
}

describe('pg-listen 1.7, as NotificationListener relies on it', () => {
  beforeEach(() => {
    mockClients.length = 0;
  });

  afterEach(async () => {
    jest.useRealTimers();
    await Promise.all(
      cleanups.splice(0).map((c) => c().catch(() => undefined)),
    );
  });

  it('emits `connected` from connect(), before the LISTEN', async () => {
    const subscriber = createPgSubscriber({ host: 'db' });
    cleanups.push(() => subscriber.close());
    const queriesWhenConnected: string[][] = [];
    subscriber.events.on('connected', () =>
      queriesWhenConnected.push([...mockClients[0].queries]),
    );

    await subscriber.connect();
    await subscriber.listenTo('events');

    expect(queriesWhenConnected).toEqual([[]]);
    expect(mockClients[0].queries).toEqual(['LISTEN events']);
    await subscriber.close();
  });

  it('with retryLimit: 1, reports a loss as `error` at once, without reconnecting itself', async () => {
    const subscriber = createPgSubscriber({ host: 'db' }, { retryLimit: 1 });
    cleanups.push(() => subscriber.close());
    const seen: string[] = [];
    subscriber.events.on('error', () => seen.push('error'));
    subscriber.events.on('reconnect', () => seen.push('reconnect'));
    await subscriber.connect();
    await subscriber.listenTo('events');

    mockClients[0].emit('error', new Error('terminated'));
    await flush();

    expect(seen).toEqual(['error']);
    expect(mockClients).toHaveLength(1);
    await subscriber.close();
  });

  it('calls `parse` only for a non-empty payload', async () => {
    const parse = jest.fn((s: string) => s);
    const subscriber = createPgSubscriber({ host: 'db' }, { parse });
    cleanups.push(() => subscriber.close());
    const got: unknown[] = [];
    subscriber.notifications.on('events', (p) => got.push(p));
    await subscriber.connect();
    await subscriber.listenTo('events');

    mockClients[0].notify('events', '');
    mockClients[0].notify('events', 'x');

    expect(parse).toHaveBeenCalledTimes(1);
    expect(parse).toHaveBeenCalledWith('x');
    expect(got).toEqual([undefined, 'x']);
    await subscriber.close();
  });

  it('with retries, reconnects: `reconnect` per attempt, the LISTEN again, then `connected`', async () => {
    const subscriber = createPgSubscriber(
      { host: 'db' },
      { retryTimeout: 10_000, retryInterval: 1 },
    );
    cleanups.push(() => subscriber.close());
    const seen: string[] = [];
    subscriber.events.on('reconnect', (n) => seen.push(`reconnect ${n}`));
    subscriber.events.on('connected', () =>
      seen.push(`connected, LISTEN run ${mockClients.at(-1)!.queries.length}`),
    );
    await subscriber.connect();
    await subscriber.listenTo('events');
    seen.length = 0;

    mockClients[0].emit('error', new Error('terminated'));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(seen).toEqual(['reconnect 1', 'connected, LISTEN run 1']);
    expect(mockClients).toHaveLength(2);
    expect(mockClients[1].queries).toEqual(['LISTEN events']);
    await subscriber.close();
  });

  describe('NotificationListener over it', () => {
    it('reports a loss, retries itself after 1s, and reports the reconnect', async () => {
      jest.useFakeTimers();
      const listener = new Recorder(
        'events',
        { host: 'db' },
        { logger: false },
      );
      cleanups.push(() => listener.onModuleDestroy());
      await listener.onModuleInit();
      expect(listener.events).toEqual(['listening:false']);

      mockClients[0].emit('error', new Error('terminated'));
      await flush();
      expect(listener.events).toEqual(['listening:false', 'lost']);
      expect(mockClients).toHaveLength(1);

      jest.advanceTimersByTime(1_000);
      await flush();

      expect(mockClients).toHaveLength(2);
      expect(mockClients[1].queries).toEqual(['LISTEN events']);
      expect(listener.events).toEqual([
        'listening:false',
        'lost',
        'listening:true',
      ]);
      await listener.onModuleDestroy();
      expect(mockClients[1].ended).toBe(true);
    });

    it('hands empty payloads over as undefined and keeps the connection on a bad one', async () => {
      const listener = new Recorder(
        'events',
        { host: 'db' },
        { logger: false },
      );
      cleanups.push(() => listener.onModuleDestroy());
      await listener.onModuleInit();

      mockClients[0].notify('events', '');
      mockClients[0].notify('events', 'not json');
      mockClients[0].notify('events', '{"a":1}');
      await flush();

      expect(listener.received).toEqual([undefined, { a: 1 }]);
      expect(listener.events).toEqual(['listening:false', 'bad:not json']);
      expect(mockClients).toHaveLength(1);
      expect(mockClients[0].ended).toBe(false);
      await listener.onModuleDestroy();
    });

    it("follows pg-listen's own retries when they are configured", async () => {
      const listener = new Recorder(
        'events',
        { host: 'db', retryTimeout: 10_000, retryInterval: 1 },
        { logger: false },
      );
      cleanups.push(() => listener.onModuleDestroy());
      await listener.onModuleInit();

      mockClients[0].emit('error', new Error('terminated'));
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(listener.events).toEqual([
        'listening:false',
        'lost',
        'listening:true',
      ]);
      expect(listener.isListening).toBe(true);
      expect(mockClients).toHaveLength(2);
      await listener.onModuleDestroy();
    });
  });
});
