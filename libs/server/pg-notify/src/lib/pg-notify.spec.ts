import { Test } from '@nestjs/testing';
import { DataSource, QueryRunner } from 'typeorm';
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
  // the DataSource import used to be type-only, so the emitted paramtype was
  // Function and Nest could not resolve it despite @Injectable()
  it('can be provided by Nest without a factory', async () => {
    const { dataSource, calls } = fakeDataSource();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PgNotifyPublisher,
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    await moduleRef.get(PgNotifyPublisher).publish('events', 'hello');

    expect(calls).toHaveLength(1);
  });

  it('sends the payload on its own connection', async () => {
    const { dataSource, calls } = fakeDataSource();
    await new PgNotifyPublisher(dataSource).publish('events', 'hello');

    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain('pg_notify');
    expect(calls[0].params).toEqual(['events', 'hello']);
  });

  it('rejects a channel postgres would reject, without querying', async () => {
    const { dataSource, calls } = fakeDataSource();
    const publisher = new PgNotifyPublisher(dataSource);

    await expect(publisher.publish('', 'x')).rejects.toThrow('cannot be empty');
    await expect(publisher.publish('c'.repeat(64), 'x')).rejects.toThrow(
      'Postgres allows at most 63',
    );
    await expect(publisher.publishJson('a\0b', {})).rejects.toThrow('NUL');
    expect(calls).toHaveLength(0);
  });

  it('serializes json payloads', async () => {
    const { dataSource, calls } = fakeDataSource();
    await new PgNotifyPublisher(dataSource).publishJson('events', { a: 1 });

    expect(calls[0].params?.[1]).toBe('{"a":1}');
  });

  // postgres requires a payload shorter than 8000 bytes: 7999 is the largest
  it('accepts a 7999 byte payload', async () => {
    const { dataSource, calls } = fakeDataSource();
    await new PgNotifyPublisher(dataSource).publish('events', 'x'.repeat(7999));

    expect(calls).toHaveLength(1);
    expect(PG_NOTIFY_MAX_PAYLOAD_BYTES).toBe(7999);
  });

  it('drops an 8000 byte payload, which postgres rejects', async () => {
    const { dataSource, calls } = fakeDataSource();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await new PgNotifyPublisher(dataSource).publish('events', 'x'.repeat(8000));

    expect(calls).toHaveLength(0);
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

    // every character is 4 bytes: 2000 of them are 8000 bytes, 1999 are 7996
    await new PgNotifyPublisher(dataSource).publish(
      'events',
      '𝍧'.repeat(2000),
    );
    expect(calls).toHaveLength(0);

    await new PgNotifyPublisher(dataSource).publish(
      'events',
      '𝍧'.repeat(1999),
    );
    expect(calls).toHaveLength(1);
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

    expect(queries[0]).toContain('json_build_object( \'id\', notify_row."id"');
    expect(queries[0]).toContain('\'kind\', notify_row."kind"');
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

  // NEW is not bound (or NULL) in a delete trigger, so the row is picked by
  // TG_OP: a delete sends the deleted row's values, even beside other events
  it('reads OLD on DELETE and NEW otherwise, chosen at run time', async () => {
    const { runner, queries } = fakeQueryRunner();
    await createNotifyTrigger(runner, {
      table: 'outbox',
      channel: 'c',
      columns: ['id'],
      events: ['INSERT', 'DELETE'],
    });

    expect(queries[0]).toContain(
      "IF TG_OP = 'DELETE' THEN notify_row := OLD; ELSE notify_row := NEW; END IF;",
    );
    expect(queries[0]).toContain('notify_row."id"');
    expect(queries[1]).toContain('AFTER INSERT OR DELETE ON "outbox"');
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

    expect(queries[0]).toContain('FUNCTION "notify_outbox_high_priority"()');
    expect(queries[1]).toContain('CREATE TRIGGER "trg_outbox_high_priority"');
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
