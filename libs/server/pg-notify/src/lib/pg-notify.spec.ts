import type { DataSource, QueryRunner } from 'typeorm';
import {
  createNotifyTrigger,
  dropNotifyTrigger,
} from './create-notify-trigger';
import {
  PG_NOTIFY_MAX_PAYLOAD_BYTES,
  PgNotifyPublisher,
} from './pg-notify-publisher';

function fakeDataSource() {
  const calls: { sql: string; params?: unknown[] }[] = [];
  const dataSource = {
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return [];
    },
  } as unknown as DataSource;
  return { dataSource, calls };
}

function fakeQueryRunner() {
  const queries: string[] = [];
  const runner = {
    query: async (sql: string) => {
      queries.push(sql.replace(/\s+/g, ' ').trim());
    },
  } as unknown as QueryRunner;
  return { runner, queries };
}

const oversized = 'x'.repeat(PG_NOTIFY_MAX_PAYLOAD_BYTES + 1);

describe('PgNotifyPublisher', () => {
  it('sends the payload on its own connection', async () => {
    const { dataSource, calls } = fakeDataSource();
    await new PgNotifyPublisher(dataSource).publish('events', 'hello');

    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain('pg_notify');
    expect(calls[0].params).toEqual(['events', 'hello']);
  });

  it('serializes json payloads', async () => {
    const { dataSource, calls } = fakeDataSource();
    await new PgNotifyPublisher(dataSource).publishJson('events', { a: 1 });

    expect(calls[0].params?.[1]).toBe('{"a":1}');
  });

  it('accepts a payload exactly at the limit', async () => {
    const { dataSource, calls } = fakeDataSource();
    await new PgNotifyPublisher(dataSource).publish(
      'events',
      'x'.repeat(PG_NOTIFY_MAX_PAYLOAD_BYTES),
    );

    expect(calls).toHaveLength(1);
  });

  // postgres rejects an oversized NOTIFY outright, failing the statement --
  // so an unguarded publish takes the caller down with it
  it('drops an oversized payload rather than failing the statement', async () => {
    const { dataSource, calls } = fakeDataSource();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await new PgNotifyPublisher(dataSource).publish('events', oversized);

    expect(calls).toHaveLength(0);
  });

  it('sends the fallback an onOversized handler returns', async () => {
    const { dataSource, calls } = fakeDataSource();
    const publisher = new PgNotifyPublisher(dataSource, {
      onOversized: () => JSON.stringify({ id: 'row-1', reload: true }),
    });

    await publisher.publish('events', oversized);

    expect(calls).toHaveLength(1);
    expect(calls[0].params?.[1]).toBe('{"id":"row-1","reload":true}');
  });

  it('drops when the fallback is itself oversized', async () => {
    const { dataSource, calls } = fakeDataSource();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const publisher = new PgNotifyPublisher(dataSource, {
      onOversized: () => oversized,
    });

    await publisher.publish('events', oversized);

    expect(calls).toHaveLength(0);
  });

  // the limit is bytes, not characters
  it('measures the limit in bytes', async () => {
    const { dataSource, calls } = fakeDataSource();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    // every character is 4 bytes, so half the character budget is over the limit
    await new PgNotifyPublisher(dataSource).publish(
      'events',
      '𝍧'.repeat(PG_NOTIFY_MAX_PAYLOAD_BYTES / 2),
    );

    expect(calls).toHaveLength(0);
  });
});

describe('createNotifyTrigger', () => {
  it('builds a payload from the named columns', async () => {
    const { runner, queries } = fakeQueryRunner();
    await createNotifyTrigger(runner, {
      table: 'outbox',
      channel: 'outbox_events',
      columns: ['id', 'kind'],
    });

    expect(queries[0]).toContain('json_build_object( \'id\', NEW."id"');
    expect(queries[0]).toContain('\'kind\', NEW."kind"');
    expect(queries[0]).toContain("pg_notify('outbox_events'");
  });

  it('fires on INSERT by default', async () => {
    const { runner, queries } = fakeQueryRunner();
    await createNotifyTrigger(runner, {
      table: 'outbox',
      channel: 'c',
      columns: ['id'],
    });

    expect(queries[1]).toContain('AFTER INSERT ON "outbox"');
  });

  it('combines the requested events', async () => {
    const { runner, queries } = fakeQueryRunner();
    await createNotifyTrigger(runner, {
      table: 'outbox',
      channel: 'c',
      columns: ['id'],
      events: ['INSERT', 'UPDATE'],
    });

    expect(queries[1]).toContain('AFTER INSERT OR UPDATE ON "outbox"');
  });

  // NEW is not bound in a delete trigger; reading it would raise at runtime
  it('reads OLD for a delete-only trigger', async () => {
    const { runner, queries } = fakeQueryRunner();
    await createNotifyTrigger(runner, {
      table: 'outbox',
      channel: 'c',
      columns: ['id'],
      events: ['DELETE'],
    });

    expect(queries[0]).toContain('OLD."id"');
    expect(queries[0]).toContain('RETURN OLD');
  });

  it('honours explicit names so a table can carry several triggers', async () => {
    const { runner, queries } = fakeQueryRunner();
    await createNotifyTrigger(runner, {
      table: 'outbox',
      channel: 'c',
      columns: ['id'],
      functionName: 'notify_outbox_high_priority',
      triggerName: 'trg_outbox_high_priority',
    });

    expect(queries[0]).toContain('FUNCTION notify_outbox_high_priority()');
    expect(queries[1]).toContain('CREATE TRIGGER trg_outbox_high_priority');
  });
});

describe('dropNotifyTrigger', () => {
  it('drops the trigger before the function it depends on', async () => {
    const { runner, queries } = fakeQueryRunner();
    await dropNotifyTrigger(runner, {
      table: 'outbox',
      channel: 'c',
      columns: ['id'],
    });

    expect(queries[0]).toContain('DROP TRIGGER IF EXISTS');
    expect(queries[1]).toContain('DROP FUNCTION IF EXISTS');
  });
});
