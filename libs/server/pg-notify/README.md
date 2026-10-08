# @onivoro/server-pg-notify

Postgres `LISTEN`/`NOTIFY` for NestJS: a subscription that survives losing its
connection, a publisher that respects the payload limit, and trigger helpers for
migrations.

Useful whenever several instances of a service need to hear about the same
event and you would rather not run a broker to do it.

## Installation

```bash
npm install @onivoro/server-pg-notify pg-listen pg typeorm
```

Peer dependencies: `@nestjs/common` (10 or 11), `pg-listen` (^1.7, which itself needs
`pg`), and `typeorm` (^0.3).

## Listening

Extend `NotificationListener` with the channel and a payload type, and register
the subclass as a provider:

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

Connection details come from the TypeORM `DataSource` (which must use the
Postgres driver), so the subscription uses the same credentials as the rest of
the application: `url`, `host`, `username`, `password`, `database`, `port`,
`ssl`, `connectTimeoutMS`, `applicationName`, `poolSize`, and anything in
`extra` (spread last, so it can override the settings below).

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

Concretely: `pg-listen` is given a 30 second `retryTimeout`. When it still gives
up, the listener tears the subscriber down and builds a new one after 1s, then
2s, 4s, and so on, capped at 30s, resetting after a successful subscribe.
Reconnection is unbounded with capped backoff. Bounded attempts end in a process
that is running and permanently deaf, which is the failure nobody notices.

## Publishing

`PgNotifyPublisher` takes a TypeORM `DataSource` and optional
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

To pass options (such as `onOversized`), or to use a non-default `DataSource`,
provide it with a factory instead:

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

Both run `SELECT pg_notify($1, $2)` through `dataSource.query`.

Two things this handles that a bare `pg_notify` call does not.

**It publishes on its own connection.** `pg_notify` inside a transaction
delivers at `COMMIT`, not at call time. Publish on a caller's transaction and
every notification is held until the unit of work ends — which, for anything
streaming, defeats the point entirely. The tradeoff is that a notification can
arrive for a transaction that later rolls back; a receiver that reads the row
back finds nothing, which is the safer of the two failure modes.

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
EACH ROW` trigger on the table. `events` defaults to `['INSERT']`. The function
and trigger are named `notify_<table>_changed` and `trg_notify_<table>_changed`
unless you pass `functionName` / `triggerName`, which you need when one table
carries several notify triggers. The trigger is created with `CREATE TRIGGER`
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

## Fanning out a stream across instances

The combination this exists for: one instance runs the work and every instance
serves clients. Publish from wherever the work happens, listen everywhere, and
filter locally to the clients each instance is actually holding.

One channel with a discriminator in the payload beats a channel per subject —
`LISTEN`/`UNLISTEN` per subscriber leaks subscriptions when a client disappears,
and the filtering is cheaper than the bookkeeping.

## License

MIT
