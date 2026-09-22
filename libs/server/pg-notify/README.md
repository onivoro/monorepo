# @onivoro/server-pg-notify

Postgres `LISTEN`/`NOTIFY` for NestJS: a subscription that survives losing its
connection, a publisher that respects the payload limit, and trigger helpers for
migrations.

Useful whenever several instances of a service need to hear about the same
event and you would rather not run a broker to do it.

## Installation

```bash
npm install @onivoro/server-pg-notify pg-listen typeorm
```

## Listening

Extend `NotificationListener` with the channel and a payload type:

```ts
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

Connection details come from the TypeORM `DataSource`, so the subscription uses
the same credentials as the rest of the application.

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

Reconnection is unbounded with capped backoff. Bounded attempts end in a process
that is running and permanently deaf, which is the failure nobody notices.

## Publishing

```ts
await publisher.publishJson('outbox_events', { id, kind });
```

Two things this handles that a bare `pg_notify` call does not.

**It publishes on its own connection.** `pg_notify` inside a transaction
delivers at `COMMIT`, not at call time. Publish on a caller's transaction and
every notification is held until the unit of work ends — which, for anything
streaming, defeats the point entirely. The tradeoff is that a notification can
arrive for a transaction that later rolls back; a receiver that reads the row
back finds nothing, which is the safer of the two failure modes.

**It respects the 8000 byte limit.** Postgres rejects an oversized payload
outright, failing the statement and taking the caller with it. Oversized
payloads are dropped with a warning, or reshaped by an `onOversized` handler:

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

Keep `columns` small, for the same 8000 byte reason. A delete-only trigger reads
`OLD` rather than `NEW`, since `NEW` is not bound in one.

## Fanning out a stream across instances

The combination this exists for: one instance runs the work and every instance
serves clients. Publish from wherever the work happens, listen everywhere, and
filter locally to the clients each instance is actually holding.

One channel with a discriminator in the payload beats a channel per subject —
`LISTEN`/`UNLISTEN` per subscriber leaks subscriptions when a client disappears,
and the filtering is cheaper than the bookkeeping.

## License

MIT
