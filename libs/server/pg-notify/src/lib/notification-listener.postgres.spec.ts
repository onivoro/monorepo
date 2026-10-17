import { NotificationListener } from './notification-listener';

// Against a real Postgres, with the real pg and pg-listen. Skipped unless
// PG_NOTIFY_TEST_DATABASE_URL names a database it may use (any role that can LISTEN, NOTIFY and
// pg_terminate_backend its own connections), for example:
//
//   docker run -d --rm --name pg-notify-test -e POSTGRES_PASSWORD=pw -p 127.0.0.1:55439:5432 postgres:16-alpine
//   PG_NOTIFY_TEST_DATABASE_URL=postgres://postgres:pw@127.0.0.1:55439/postgres \
//     npx nx test lib-server-pg-notify --testFile=notification-listener.postgres.spec.ts
//   docker stop pg-notify-test

const url = process.env['PG_NOTIFY_TEST_DATABASE_URL'];

/** The bit of pg's Client this uses (the workspace has no @types/pg). */
interface PgClient {
  connect(): Promise<void>;
  query(text: string, values?: unknown[]): Promise<{ rows: any[] }>;
  end(): Promise<void>;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Client } = require('pg') as {
  Client: new (config: { connectionString?: string }) => PgClient;
};
const APP = 'pg-notify-postgres-spec';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(condition: () => boolean | Promise<boolean>, ms = 10_000) {
  const deadline = Date.now() + ms;
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error('timed out');
    await sleep(25);
  }
}

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

  protected override onBadPayload() {
    this.events.push('bad');
  }
}

(url ? describe : describe.skip)(
  'NotificationListener against Postgres',
  () => {
    let admin: PgClient;
    let listener: Recorder | undefined;

    const backends = async () =>
      (
        await admin.query(
          'select pid from pg_stat_activity where application_name = $1',
          [APP],
        )
      ).rows.map((row: { pid: number }) => row.pid);
    const notify = (payload: string) =>
      admin.query('select pg_notify($1, $2)', ['pg_notify_spec', payload]);
    const terminate = () =>
      admin.query(
        'select pg_terminate_backend(pid) from pg_stat_activity where application_name = $1',
        [APP],
      );

    beforeAll(async () => {
      admin = new Client({ connectionString: url });
      await admin.connect();
    });

    afterEach(async () => {
      await listener?.onModuleDestroy();
      listener = undefined;
    });

    afterAll(async () => {
      await admin?.end();
    });

    async function started() {
      listener = new Recorder(
        'pg_notify_spec',
        { connectionString: url, application_name: APP },
        { logger: false },
      );
      await listener.onModuleInit();
      return listener;
    }

    it('delivers payloads, skips a bad one on the same connection, and passes an empty one as undefined', async () => {
      const l = await started();
      const [pid] = await backends();

      await notify('{"n":1}');
      await notify('not json');
      await notify('');
      await notify('{"n":2}');
      await until(() => l.received.length === 3);

      expect(l.received).toEqual([{ n: 1 }, undefined, { n: 2 }]);
      expect(l.events).toEqual(['listening:false', 'bad']);
      expect(await backends()).toEqual([pid]);
    });

    it('reports a lost connection, and re-establishes it after about a second', async () => {
      const l = await started();
      const [before] = await backends();

      await terminate();
      await until(() => l.events.includes('lost'));
      expect(l.isListening).toBe(false);

      await until(() => l.isListening);
      const after = await backends();
      expect(after).toHaveLength(1);
      expect(after[0]).not.toBe(before);
      expect(l.events).toEqual(['listening:false', 'lost', 'listening:true']);

      await notify('{"n":3}');
      await until(() => l.received.length === 1);
      expect(l.received).toEqual([{ n: 3 }]);
    });

    it('stops for good when closed mid-reconnect', async () => {
      const l = await started();

      await terminate();
      await until(() => l.events.includes('lost'));
      await l.onModuleDestroy();
      listener = undefined;
      await sleep(3_000);

      expect(await backends()).toEqual([]);
    }, 10_000);
  },
);
