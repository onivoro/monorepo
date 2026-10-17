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

Peer dependencies: `pg` (7.x or 8.x, as `pg-listen` requires), `pg-listen`
(~1.7, the release the listener's reconnect handling is tested against), and optionally `@nestjs/common` (10 or 11) and `typeorm` (^0.3). The
package loads `typeorm` only when Nest resolves `PgNotifyPublisher` as a plain
class provider (to inject the `DataSource` by type), so without TypeORM nothing
needs it installed. Its types are still referenced from the declarations, which
compile without it under `skipLibCheck` (the Nest default).

`@nestjs/common` is needed by the package's main entry point (the publisher, the
trigger helpers, and a `NotificationListener` that logs through Nest's
`Logger`). Without Nest, import from `@onivoro/server-pg-notify/listener`, which
has `NotificationListener`, `buildNotifyQuery` and `notifyInTransaction`, and
never loads Nest or TypeORM, even when they are installed: its
`NotificationListener` logs to `console` unless given a `logger`. The main
entry's `NotificationListener` is a subclass of that one.

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

The constructor throws for a channel that is empty, over 63 bytes or contains a
NUL character: `LISTEN` would quietly truncate a long one and wait on a channel
nothing sends to.

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
rather than leaving an app that looks healthy and receives nothing; it leaves
no connection and no retry behind. `onModuleDestroy` stops every retry, and
waits for (and closes) a connection still being made. The channel name is
available to subclasses as `this.channel`.

`onNotification` may return a promise. What it throws or rejects with is
logged and goes no further: `pg` calls it from its socket handler, where a
throw would end the process. Only the error's name is logged (`A pg "outbox"
notification failed in onNotification: ZodError`), since a validation error's
message often quotes the values it rejected, which anyone who can `NOTIFY` can
write. To log more, catch inside `onNotification`.

### Payloads

Each payload is parsed as JSON by the listener, not by `pg-listen`. A payload
that doesn't parse goes to `onBadPayload(raw, error)` instead of
`onNotification`, and the connection is kept; by default it logs a warning with
the payload's length but not its content, since anyone who can connect to the
database can `NOTIFY`. Pass `parse` to read something other than JSON; a throw
from it goes to `onBadPayload` too.

`error` is a `NotificationPayloadError`: its message gives the payload's length,
what the parser threw (`parseErrorName`, such as `SyntaxError`) and, when the
parser said, the `position`, but never the payload, so it is safe to log.
(`JSON.parse`'s own message quotes the payload, so it isn't kept, not even as
`cause`.) The payload is only the `raw` argument.

Postgres delivers `NOTIFY ch` and `NOTIFY ch, ''` alike, as an empty payload.
Either reaches `onNotification` as `undefined`, and `parse` is never called for
it.

### Knowing when it is listening

```ts
@Injectable()
export class OutboxListener extends NotificationListener<OutboxEvent> {
  constructor(
    dataSource: DataSource,
    private readonly outbox: OutboxReader,
  ) {
    super('outbox_events', dataSource);
  }

  onNotification(payload: OutboxEvent) {
    // ...
  }

  // After every LISTEN that succeeds.
  protected override async onListening({ reconnected }: { reconnected: boolean }) {
    // Nothing sent while the connection was down was delivered: catch up.
    if (reconnected) await this.outbox.replayUnseen();
  }

  // When the connection is lost, before any retry.
  protected override onConnectionLost(error: Error) {
    metrics.increment('outbox_listener_lost');
  }

  protected override onBadPayload(raw: string, error: Error) {
    metrics.increment('outbox_listener_bad_payload');
  }
}
```

- `onListening({ reconnected })` runs after every `LISTEN` that succeeds: the
  first with `reconnected: false`, and each after a lost connection with
  `true`.
- `onConnectionLost(error)` runs once per loss, before any retry.
- `isListening` is `true` from each successful `LISTEN` until the next loss or
  `onModuleDestroy`. While it is `false`, notifications are missed.
- Any hook may be `async`. What a hook throws, or rejects with, is logged and
  goes no further (the hooks run from `pg-listen`'s event handlers, where an
  unhandled rejection would end the process). `onBadPayload`'s and
  `onNotification`'s errors are logged by name only, since they may quote the
  payload.

### Options

The constructor's third argument is optional:

| Option   | Default                                                         | Does                                                                         |
| -------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `logger` | Nest's `Logger` from the main entry; `console` from `/listener` | Where to log; anything with `log`, `warn` and `error`. `false` logs nothing. |
| `parse`  | `JSON.parse`                                                    | Turns a payload into what `onNotification` gets.                             |

Without Nest:

```ts
import { NotificationListener } from '@onivoro/server-pg-notify/listener';

const listener = new (class extends NotificationListener<OutboxEvent> {
  onNotification(payload: OutboxEvent) {
    // ...
  }
})('outbox_events', process.env.DATABASE_URL!, { logger: myLogger });

await listener.onModuleInit(); // resolves once the LISTEN is in place
// ...
await listener.onModuleDestroy();
```

### Why this is not twenty lines

`pg-listen` emits `error` on its own `EventEmitter`, and an unhandled `'error'`
event terminates the Node process. A subscription that is not even on the
request path can therefore take the whole API down, and under a supervisor that
becomes a crash loop. This listener handles three things, and the third is the
one that is easy to miss:

1. **Handle the error**, which stops the crash.
2. **Own the retries.** `pg-listen`'s own reconnect loop can't be stopped once
   it starts (it never checks whether it was closed), so a listener closed
   mid-reconnect would go on connecting. The listener gives `pg-listen`
   `retryLimit: 1`, so it makes no attempt of its own and reports a lost
   connection at once, and does every retry itself.
3. **Re-initialise after every loss**, because a process that no longer crashes
   but is silently deaf is a worse trade: a crash at least restarts into a
   working listener.

Concretely: on a lost connection the listener tears the subscriber down and
builds a new one after 1s, then 2s, 4s, and so on, capped at 30s, resetting
after a successful subscribe. Reconnection is unbounded with capped backoff.
Bounded attempts end in a process that is running and permanently deaf, which
is the failure nobody notices. Closing the listener stops it.

Setting any of `pg-listen`'s retry options (`retryTimeout`, `retryInterval`,
`retryLimit`) hands reconnecting back to `pg-listen`, as before: its window is
then 30 seconds unless you set `retryTimeout`, the listener reports its
reconnects through `onConnectionLost` and `onListening`, closes any connection
it makes after the listener was closed, and re-initialises when it gives up.

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

**It respects the payload limit.** Postgres requires a payload shorter than 8000
bytes, so the largest it accepts is 7999 UTF-8 bytes (exported as
`PG_NOTIFY_MAX_PAYLOAD_BYTES`); exactly 8000 is already too long. It rejects an
oversized payload outright, failing the statement and taking the caller with it.
Oversized payloads are dropped with a warning, or reshaped by an
`onOversized(payload, channel)` handler. If the handler returns `undefined`, or
a replacement that is still over the limit, the notification is dropped and
logged; `publish` does not throw in either case:

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
`undefined` when the payload is dropped for size. It applies the same limit
(under 8000 bytes) and the same `onOversized(payload, channel)` hook as the
publisher; `payload` is what will actually be sent (the original or its
replacement). It does not log -- an `undefined` is yours to handle. It throws
for a channel `pg_notify` would reject -- empty, over 63 bytes, or containing a
NUL character -- so the mistake surfaces in your code rather than as a failed
statement that aborts the transaction.

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
does not occur in it. Table names keep their case exactly, as before.

**Function and trigger names** are read the way Postgres read them when earlier
versions emitted them unquoted. `functionName: 'app.notify_outbox'` is function
`notify_outbox` in schema `app`; a plain part (letters, digits, `_`, `$` and
non-ASCII characters, not starting with a digit or `$`) has its ASCII letters
lowercased, so `Notify_Outbox` is `notify_outbox`; a
double-quoted part is taken literally, so `'"MyFn"'` is `MyFn` and
`'app."MyFn"'` is `MyFn` in `app`. The generated defaults follow the same
folding. So for options that produced valid SQL before, a down migration
written against an earlier version drops the same objects it created; the one
exception is a three-part `db.schema.name` function name, which now throws.
Whitespace around a name and its dots is ignored, as it was in SQL. A name
that does not parse as SQL (`'notify-outbox'`) could not have worked before and
is now taken whole, literally. A trigger name cannot be schema-qualified, and a
function name has at most two parts; either mistake throws.

**Limits.** Empty names, and names or channels containing a NUL character,
throw, and so does a channel over 63 bytes, which `pg_notify` would reject on
every write. Identifiers over 63 bytes (table, schema, column, function and
trigger names, generated or explicit) are cut exactly as Postgres cuts them: to
at most 63 bytes of UTF-8, on a character boundary, so a name with multi-byte
characters can end up shorter than 63 bytes. That keeps migrations written
against earlier versions, which let Postgres do the cutting, working both ways:
re-run on a fresh database, and rolled back. The cost is the one Postgres
already had: two long names that share their first 63 bytes name the same
object. Two tables whose names share a long prefix would share
`notify_<prefix>` and `trg_notify_<prefix>`, so the second `createNotifyTrigger`
would replace the first one's function; give such tables explicit, short
`functionName` and `triggerName`s.

**Schemas.** Pass `schema`, or a schema-qualified `table` such as `'app.outbox'`
(split at the first dot). The table and the trigger function are then both
qualified with that schema, unless `functionName` names its own. When `schema`
is given, `table` is taken whole, so a table whose name contains a dot is
written `{ schema: 'public', table: 'odd.name' }`. Without either, the function
is created in the first schema of the `search_path`, as before. The trigger is
created with `CREATE TRIGGER` (not `OR REPLACE`, which needs Postgres 14), so
running it twice for the same trigger name fails rather than silently replacing
an existing trigger; run `dropNotifyTrigger` first to re-create one.

Keep `columns` small, for the same payload-limit reason. The function picks the
row by `TG_OP` when it runs: `OLD` for a `DELETE`, `NEW` otherwise. So one
trigger on `['INSERT', 'UPDATE', 'DELETE']` sends the deleted row's values on a
delete.

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

The quoting helpers are exported too: `quotePgIdentifier(name)`,
`quotePgLiteral(value)` and `truncatePgIdentifier(name)`. `quotePgIdentifier`
is strict and throws for a name over 63 bytes rather than let Postgres cut it;
the trigger builders instead pass each name through `truncatePgIdentifier`
first, for the compatibility reasons above.

## Behaviour changes since 25.0.2

The monorepo keeps no changelog, so the changes since
`@onivoro/server-pg-notify` 25.0.2 that existing users should check are listed
here:

1. **Payload limit.** `PG_NOTIFY_MAX_PAYLOAD_BYTES` is now 7999, the largest
   payload Postgres accepts. It was 8000, which let an exactly-8000-byte
   payload through to a statement Postgres then failed; such payloads now go
   to `onOversized` or are dropped like any other oversized payload.
2. **Dotted table names.** A `table` containing a dot is now read as
   `schema.table`: `'a.b'` is table `b` in schema `a`, emitted `"a"."b"`.
   Before, it was emitted as the single identifier `"a.b"`. To keep a table
   whose name really contains a dot, pass `schema` (for example
   `{ schema: 'public', table: 'a.b' }`), and `table` is taken whole.
3. **Quoted names.** Function and trigger names are now always quoted. Names
   that were valid unquoted resolve to the same objects as before (see
   "Function and trigger names" above), including schema-qualified and
   double-quoted `functionName`s, so existing down migrations still work.
4. **Channels are checked.** A channel that is empty, over 63 bytes or
   contains a NUL character now throws up front: when a `NotificationListener`
   is constructed, from `PgNotifyPublisher.publish`, `buildNotifyQuery` and
   `notifyInTransaction`, and from the trigger builders. Before, a long
   channel failed at `pg_notify` time, and `LISTEN` silently truncated it and
   listened on a channel nothing sent to. Long identifiers, by contrast, are
   still cut as Postgres cuts them (see "Limits" above).
5. **Trigger function body.** The generated function now chooses `OLD` or
   `NEW` by `TG_OP`, so a trigger mixing `DELETE` with other events sends real
   values on delete instead of `null`s. Re-run `createNotifyTrigger` (it uses
   `CREATE OR REPLACE FUNCTION`) to update an existing function.
6. **Generated SQL text changed** (quoting, the `$notify$` dollar-quote tag, the
   function body). Only tests or snapshots that compare the SQL text are
   affected.
7. **Retry window.** `NotificationListener` now passes `retryTimeout` (30s) and
   the other retry settings in `pg-listen`'s options argument, where it reads
   them. Before, they went in the connection settings and were ignored, so
   `pg-listen`'s 3 second default applied; reconnection now keeps trying for
   the documented 30 seconds before the listener's own re-initialisation
   takes over.
8. **Types.** `PgNotifyPublisherOptions` is now a type alias of
   `NotifyPayloadOptions` rather than an interface, so it can no longer be
   extended by declaration merging. `createNotifyTrigger` / `dropNotifyTrigger`
   and `PgNotifyPublisher` accept anything with a `query` method; a TypeORM
   `QueryRunner` or `DataSource` still fits.
9. **Peer dependencies.** `typeorm` is now optional, and `pg` (7.x or 8.x) is
   listed, as `pg-listen` already required it.

## Behaviour changes since 25.3.2

1. **Retries.** By default `pg-listen` now gets `retryLimit: 1` instead of a
   30 second `retryTimeout`, and the listener does every retry: the first
   after 1 second (`pg-listen` tried at once, then every 500ms), then backing
   off to 30 seconds. Set one of `pg-listen`'s retry options to keep its
   loop; see "Why this is not twenty lines".
2. **Payloads that aren't JSON** used to be a connection error: `pg-listen`
   failed to parse them and the listener reconnected. Now they go to
   `onBadPayload`, which logs a warning, and the connection is kept.
3. **A throwing `onNotification` no longer ends the process.** What it throws
   (or rejects with) is now logged, by the error's name, and the next
   notification is delivered as usual. Before, a throw escaped into `pg`'s
   socket handler and a rejection was unhandled, either of which could end the
   process. If you relied on that (a supervisor restarting the process, which
   then re-read its state), the process now keeps running on a handler that
   fails on every notification, and the only sign is an error log line for
   each. Catch inside `onNotification` and decide there: re-read state, raise
   an alert, or exit deliberately (`process.exit`).
4. **A failed boot** (`onModuleInit` rejecting) now closes its connection and
   schedules no retry. Before, the half-made subscriber could keep
   reconnecting until `onModuleDestroy` was called.
5. **`onModuleDestroy`** now also waits for a subscribe in progress and closes
   its connection.
6. **New members.** `NotificationListener` has new protected methods
   `onListening`, `onConnectionLost` and `onBadPayload`, and a getter
   `isListening`. A subclass that already has members with those names now
   overrides them; rename yours if they mean something else. In particular, a
   subclass that declares a property `isListening` (say `isListening = false`)
   no longer compiles (TS2610: a property can't override an accessor), and in
   JavaScript, or with `useDefineForClassFields`, the field hides the getter,
   so `isListening` reports your value, never the listener's. Rename the
   property, or drop it and read the listener's `isListening`. The class no
   longer declares `implements OnModuleInit, OnModuleDestroy`; Nest still
   calls both methods.
7. **Peer dependencies.** `@nestjs/common` is now optional; the
   `/listener` entry point doesn't need it. `pg-listen` is now `~1.7.0`
   (was `^1.7.0`), since the reconnect handling relies on how 1.7 behaves
   (pinned by `pg-listen-contract.spec.ts`); 1.7.0 is the current release.
8. **Log lines.** A failing `onNotification` logs `A pg "<channel>"
notification failed in onNotification: <error name>` (it was `... failed:
<message>`), and a failing `onBadPayload` logs its error's name only.
   Alerts matching the old text need updating.
9. **`onBadPayload`'s `error`** is a `NotificationPayloadError`, not the
   parser's own error; read `parseErrorName` and `position` instead of
   `message`.

## Fanning out a stream across instances

The combination this exists for: one instance runs the work and every instance
serves clients. Publish from wherever the work happens, listen everywhere, and
filter locally to the clients each instance is actually holding.

One channel with a discriminator in the payload beats a channel per subject —
`LISTEN`/`UNLISTEN` per subscriber leaks subscriptions when a client disappears,
and the filtering is cheaper than the bookkeeping.

## License

MIT
