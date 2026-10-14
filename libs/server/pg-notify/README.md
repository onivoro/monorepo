# @onivoro/server-pg-notify

Postgres `LISTEN`/`NOTIFY` for NestJS: a subscription that survives losing its
connection, a publisher that respects the payload limit, notifications that are
sent only when your transaction commits, and trigger helpers for migrations.
TypeORM is supported but optional: everything also works over plain `pg`, and so
from Kysely.

Useful whenever several instances of a service need to hear about the same
event and you would rather not run a broker to do it.

## Installation

```bash
npm install @onivoro/server-pg-notify pg-listen pg
npm install typeorm   # only if you pass TypeORM DataSources
```

Peer dependencies: `@nestjs/common` (10 or 11), `pg-listen` (^1.7, which itself needs
`pg`), and optionally `typeorm` (^0.3). The package loads `typeorm` only when
Nest resolves `PgNotifyPublisher` as a plain class provider (to inject the
`DataSource` by type), so without TypeORM nothing needs it installed. Its types are still referenced from the declarations, which
compile without it under `skipLibCheck` (the Nest default).

## Listening

Extend `NotificationListener` with the channel and a payload type, and register
the subclass as a provider. The second argument says where to connect: a
TypeORM `DataSource`, node-postgres connection settings (`pg`'s `ClientConfig`),
or a connection string.

```ts
import { Injectable } from '@nestjs/common';
import { NotificationListener } from '@onivoro/server-pg-notify';
import { DataSource } from 'typeorm';

type OutboxEvent = { id: string; kind: string };

@Injectable()
export class OutboxListener extends NotificationListener<OutboxEvent> {
  constructor(dataSource: DataSource) {
    super('outbox_events', dataSource);
  }

  onNotification(payload: OutboxEvent) {
    // ...
  }
}
```

Without TypeORM, pass the `pg` settings (or a connection string) instead. The
listener always opens its own dedicated connection; it never borrows one from
your pool:

```ts
@Injectable()
export class OutboxListener extends NotificationListener<OutboxEvent> {
  constructor(config: AppConfig) {
    super('outbox_events', { connectionString: config.databaseUrl, ssl: true });
    // or: super('outbox_events', config.databaseUrl);
  }

  onNotification(payload: OutboxEvent) {
    // ...
  }
}
```

The accepted types are exported as `NotificationListenerConnection`
(`DataSource | PgClientConfig | string`) and `PgClientConfig` (the
`connectionConfig` that `pg-listen` takes, i.e. `pg`'s `ClientConfig`). A
config object is copied, never modified.

With a `DataSource` (which must use the Postgres driver), connection details
come from it, so the subscription uses the same credentials as the rest of the
application: `url`, `host`, `username`, `password`, `database`, `port`, `ssl`,
`connectTimeoutMS`, `applicationName`, `poolSize`, and anything in `extra`
(spread last, so it can override them).

Either way, `pg-listen`'s own retry options (`retryTimeout`, `retryInterval`,
`retryLimit`, `paranoidChecking`) can be set in the same place -- in `extra`, or
in the `pg` config -- and are passed to `pg-listen` as its options rather than
as connection settings.

The subscription is opened in `onModuleInit` and closed in `onModuleDestroy`.
A failure to connect at boot is not caught, so it fails application startup
rather than leaving an app that looks healthy and receives nothing.
`onNotification` may return a promise. The channel name is available to
subclasses as `this.channel`.

### Why this is not twenty lines

`pg-listen` emits `error` on its own `EventEmitter`, and an unhandled `'error'`
event terminates the Node process. A subscription that is not even on the
request path can therefore take the whole API down, and under a supervisor that
becomes a crash loop. This listener handles three things, and the third is the
one that is easy to miss:

1. **Handle the error**, which stops the crash.
2. **Raise the retry window** past `pg-listen`'s 3 second default. Most things
   that interrupt a database connection — a failover, a deploy, a tunnel
   dropping — last longer than that, so the ordinary case was reaching the
   give-up path rather than reconnecting through it.
3. **Re-initialise afterwards**, because a process that no longer crashes but is
   silently deaf is a worse trade: a crash at least restarts into a working
   listener.

Concretely: `pg-listen` is given a 30 second `retryTimeout` (in its options
argument; versions before this one put it in the connection settings, where
`pg-listen` never read it, so the 3 second default stayed in force). When it still gives
up, the listener tears the subscriber down and builds a new one after 1s, then
2s, 4s, and so on, capped at 30s, resetting after a successful subscribe.
Reconnection is unbounded with capped backoff. Bounded attempts end in a process
that is running and permanently deaf, which is the failure nobody notices.

## Publishing

There are two ways to send, and they differ in when the notification goes out:

|                                            | Runs on                       | Delivered                                   |
| ------------------------------------------ | ----------------------------- | ------------------------------------------- |
| `PgNotifyPublisher`                        | its own pooled connection     | immediately, whatever your transaction does |
| `notifyInTransaction` / `buildNotifyQuery` | your transaction's connection | at `COMMIT`; never on `ROLLBACK`            |

Use the first for streaming; use the second when the notification announces a
write and must not exist unless the write does -- a transactional outbox.

### PgNotifyPublisher: outside your transaction

`PgNotifyPublisher` takes a TypeORM `DataSource`, or anything with
`query(text, values)` such as a `pg` `Pool`, and optional
`PgNotifyPublisherOptions`. It is `@Injectable()` and resolves the `DataSource`
by type, so with `@nestjs/typeorm` (or any provider registered under the
`DataSource` class) it can be listed as a plain provider; the options are
`@Optional()` and default to `{}`:

```ts
import { Module } from '@nestjs/common';
import { PgNotifyPublisher } from '@onivoro/server-pg-notify';

@Module({
  providers: [PgNotifyPublisher],
  exports: [PgNotifyPublisher],
})
export class NotifyModule {}
```

To pass options (such as `onOversized`), to use a non-default `DataSource`, or
to publish through a `pg` `Pool` without TypeORM, provide it with a factory
instead:

```ts
{
  provide: PgNotifyPublisher,
  useFactory: (dataSource: DataSource) =>
    new PgNotifyPublisher(dataSource, { onOversized }),
  inject: [DataSource],
}
```

```ts
await publisher.publish('outbox_events', 'refresh'); // raw string payload
await publisher.publishJson('outbox_events', { id, kind }); // JSON.stringify(payload)
```

```ts
{
  provide: PgNotifyPublisher,
  useFactory: (pool: Pool) => new PgNotifyPublisher(pool, { onOversized }),
  inject: [Pool],
}
```

Both run `SELECT pg_notify($1, $2)` through `dataSource.query` (or
`pool.query`).

Two things this handles that a bare `pg_notify` call does not.

**It publishes on its own connection, outside any transaction of yours.**
`pg_notify` inside a transaction delivers at `COMMIT`, not at call time. Publish
on a caller's transaction and every notification is held until the unit of work
ends — which, for anything streaming, defeats the point entirely. The tradeoff
is that a notification can arrive for a transaction that later rolls back, or
before it commits; a receiver that reads the row back finds nothing, which is
the safer of the two failure modes. When that is not acceptable, see the next
section.

**It respects the 8000 byte limit** (exported as `PG_NOTIFY_MAX_PAYLOAD_BYTES`,
measured as UTF-8 bytes). Postgres rejects an oversized payload outright,
failing the statement and taking the caller with it. Oversized payloads are
dropped with a warning, or reshaped by an `onOversized(payload, channel)`
handler. If the handler returns `undefined`, or a replacement that is still over
the limit, the notification is dropped and logged; `publish` does not throw in
either case:

```ts
new PgNotifyPublisher(dataSource, {
  onOversized: (payload) => JSON.stringify({ id: idOf(payload), reload: true }),
});
```

That is the pattern worth reaching for generally — send a signal, let the
receiver read the row. It has to read the row anyway if it cares about the state
after any later write.

### In your transaction: delivered only on commit

`buildNotifyQuery(channel, payload, options?)` is a pure function that returns
`{ text, values, channel, payload }` for `SELECT pg_notify($1, $2)`, or
`undefined` when the payload is dropped for size. It applies the same 8000 byte
rule and the same `onOversized(payload, channel)` hook as the publisher;
`payload` is what will actually be sent (the original or its replacement). It
does not log -- an `undefined` is yours to handle.

`notifyInTransaction(client, channel, payload, options?)` runs that query on any
client with `query(text, values)` and resolves `true` once it has run, or
`false` (without querying) when the payload was dropped. A failing query
rejects, so your transaction sees it.

Run either on the connection that holds the transaction. With `pg` that is the
`PoolClient` you sent `BEGIN` on -- not the `Pool`, whose `query` takes some
other connection and notifies immediately:

```ts
import { notifyInTransaction } from '@onivoro/server-pg-notify';

const client = await pool.connect();
try {
  await client.query('BEGIN');
  const { rows } = await client.query('INSERT INTO outbox (kind, body) VALUES ($1, $2) RETURNING id', [kind, body]);
  await notifyInTransaction(client, 'outbox_events', JSON.stringify({ id: rows[0].id }));
  await client.query('COMMIT'); // the notification is delivered here
} catch (error) {
  await client.query('ROLLBACK'); // and never, if this runs
  throw error;
} finally {
  client.release();
}
```

With Kysely, run the built query inside `db.transaction()`, either as a compiled
query or through the `sql` tag:

```ts
import { CompiledQuery, sql } from 'kysely';
import { buildNotifyQuery } from '@onivoro/server-pg-notify';

await db.transaction().execute(async (trx) => {
  const { id } = await trx.insertInto('outbox').values({ kind, body }).returning('id').executeTakeFirstOrThrow();

  const notify = buildNotifyQuery('outbox_events', JSON.stringify({ id }));
  if (notify) {
    await trx.executeQuery(CompiledQuery.raw(notify.text, notify.values));
    // or: await sql`select pg_notify(${notify.channel}, ${notify.payload})`.execute(trx);
  }
});
```

Two Postgres behaviours to know. Notifications sent in one transaction are
delivered together at commit, in the order they were sent. And Postgres drops a
notification that repeats the channel _and_ payload of one already sent in the
same transaction, so put something distinguishing (an id) in the payload when
each one matters.

In an outbox, the notification is the fast path, not the guarantee: a listener
that is disconnected at commit time misses it, so the consumer should also poll
the outbox table on start and periodically.

## Triggers

For notifications that should follow a row change rather than an explicit call:

```ts
await createNotifyTrigger(queryRunner, {
  table: 'outbox',
  channel: 'outbox_events',
  columns: ['id', 'kind'],
  events: ['INSERT'],
});
```

`createNotifyTrigger` creates (or replaces) a plpgsql function that sends
`json_build_object` of the listed columns to the channel, then an `AFTER ... FOR
EACH ROW` trigger on the table. Being a trigger, it notifies in the writing
transaction, so delivery is at `COMMIT`. `events` defaults to `['INSERT']`; any
value other than `INSERT`, `UPDATE` or `DELETE` throws. The function and trigger
are named `notify_<table>_changed` and `trg_notify_<table>_changed` unless you
pass `functionName` / `triggerName`, which you need when one table carries
several notify triggers.

The first argument is anything with `query(sql)`: a TypeORM `QueryRunner`, a
`pg` `Client`, and so on.

**Quoting.** Every identifier is double-quoted with embedded double quotes
doubled, and the channel and column keys are emitted as escaped string literals
(an `E'...'` literal when they contain a backslash), so hostile or unusual names
cannot change the statement. The function body is dollar-quoted with a tag that
does not occur in it. Table names keep their case exactly, as before. Function
and trigger names follow the rule that applied when earlier versions emitted
them unquoted: a plain name (letters, digits, `_`, `$`, not starting with a
digit) is lowercased, as Postgres folded it, so a down migration written against
an earlier version still finds what it created; any other name is taken
literally. Empty names, and names or channels containing a NUL character, throw.

**Schemas.** Pass `schema`, or a schema-qualified `table` such as
`'app.outbox'` (split at the first dot). The table and the trigger function are
then both qualified with that schema. When `schema` is given, `table` is taken
whole, so a table whose name contains a dot is written
`{ schema: 'public', table: 'odd.name' }`. Without either, the function is
created in the first schema of the `search_path`, as before. The trigger is created with `CREATE TRIGGER`
(not `OR REPLACE`, which needs Postgres 14), so running it twice for the same
trigger name fails rather than silently replacing an existing trigger; run
`dropNotifyTrigger` first to re-create one.

Keep `columns` small, for the same 8000 byte reason. A delete-only trigger
(`events: ['DELETE']`) reads `OLD` rather than `NEW`, since `NEW` is not bound in
one. Any other combination reads `NEW`, so a trigger on `['INSERT', 'DELETE']`
sends `null` column values for deletes; use a separate delete-only trigger with
its own names instead.

`dropNotifyTrigger` takes the same options and drops the trigger and function
(`IF EXISTS`), for the migration's `down`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';
import { createNotifyTrigger, dropNotifyTrigger, CreateNotifyTriggerOptions } from '@onivoro/server-pg-notify';

const outboxTrigger: CreateNotifyTriggerOptions = {
  table: 'outbox',
  channel: 'outbox_events',
  columns: ['id', 'kind'],
};

export class OutboxNotify1700000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner) {
    await createNotifyTrigger(queryRunner, outboxTrigger);
  }

  async down(queryRunner: QueryRunner) {
    await dropNotifyTrigger(queryRunner, outboxTrigger);
  }
}
```

### SQL for migration files

`buildNotifyTriggerSql(options)` and `buildDropNotifyTriggerSql(options)` return
the same SQL that `createNotifyTrigger` and `dropNotifyTrigger` run, as one
script of semicolon-terminated statements, without needing a connection or
TypeORM. Use them to write versioned migration files for any migration tool:

```ts
import { buildDropNotifyTriggerSql, buildNotifyTriggerSql } from '@onivoro/server-pg-notify';

const outboxTrigger = {
  schema: 'app',
  table: 'outbox',
  channel: 'outbox_events',
  columns: ['id', 'kind'],
};

writeFileSync('migrations/0007_outbox_notify.up.sql', buildNotifyTriggerSql(outboxTrigger));
writeFileSync('migrations/0007_outbox_notify.down.sql', buildDropNotifyTriggerSql(outboxTrigger));
```

Generating the file once and committing it keeps the migration fixed even if a
later version of this package changes what it generates. With Kysely's
migrator, the script can also be run as-is in `up`/`down` with
`sql.raw(buildNotifyTriggerSql(outboxTrigger)).execute(db)` (it has no
parameters, so `pg` runs both statements in one call).

The quoting helpers are exported too: `quotePgIdentifier(name)` and
`quotePgLiteral(value)`.

## Fanning out a stream across instances

The combination this exists for: one instance runs the work and every instance
serves clients. Publish from wherever the work happens, listen everywhere, and
filter locally to the clients each instance is actually holding.

One channel with a discriminator in the payload beats a channel per subject —
`LISTEN`/`UNLISTEN` per subscriber leaks subscriptions when a client disappears,
and the filtering is cheaper than the bookkeeping.

## License

MIT
