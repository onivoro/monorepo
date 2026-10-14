/**
 * The largest NOTIFY payload Postgres accepts, in UTF-8 bytes.
 *
 * Postgres requires the payload to be shorter than 8000 bytes
 * (`strlen(payload) >= NOTIFY_PAYLOAD_MAX_LENGTH` fails), so exactly 8000 is
 * rejected -- failing the statement rather than truncating. This was 8000
 * before, which let an 8000 byte payload through to that failure.
 */
export const PG_NOTIFY_MAX_PAYLOAD_BYTES = 7999;

/**
 * The longest channel name Postgres accepts, in bytes: channels are
 * identifiers, so NAMEDATALEN - 1.
 */
export const PG_MAX_IDENTIFIER_BYTES = 63;

export interface NotifyPayloadOptions {
  /**
   * What to send when a payload will not fit.
   *
   * Returning a smaller envelope -- an id the receiver can use to read the row
   * itself -- keeps delivery working for large events. Returning undefined
   * drops the notification.
   */
  onOversized?: (payload: string, channel: string) => string | undefined;
}

/** A parameterised `SELECT pg_notify($1, $2)`, ready for any pg-style driver. */
export interface NotifyQuery {
  text: string;
  values: [channel: string, payload: string];
  channel: string;
  /** The payload actually sent: the original, or the onOversized replacement. */
  payload: string;
}

/**
 * Anything with node-postgres' `query(text, values)`: a `pg` `Client`, a
 * `PoolClient` checked out of a pool, a TypeORM `QueryRunner` or `DataSource`.
 */
export interface NotifyQueryable {
  query(text: string, values?: unknown[]): unknown;
}

/** @internal How a payload fared against the limit. */
export type FittedPayload =
  | { sent: true; payload: string }
  | { sent: false; reason: 'oversized'; bytes: number }
  | { sent: false; reason: 'replacement-oversized'; bytes: number };

/** @internal Shared by buildNotifyQuery and PgNotifyPublisher. */
export function fitNotifyPayload(
  channel: string,
  payload: string,
  options: NotifyPayloadOptions = {},
): FittedPayload {
  const bytes = byteLength(payload);
  if (bytes <= PG_NOTIFY_MAX_PAYLOAD_BYTES) return { sent: true, payload };

  const fallback = options.onOversized?.(payload, channel);
  if (fallback === undefined)
    return { sent: false, reason: 'oversized', bytes };

  const fallbackBytes = byteLength(fallback);
  if (fallbackBytes > PG_NOTIFY_MAX_PAYLOAD_BYTES) {
    return {
      sent: false,
      reason: 'replacement-oversized',
      bytes: fallbackBytes,
    };
  }

  return { sent: true, payload: fallback };
}

/**
 * Builds `SELECT pg_notify($1, $2)` for one notification, without running it.
 *
 * Run the result on the connection that holds your transaction and Postgres
 * delivers the notification at COMMIT, and not at all on ROLLBACK -- which is
 * what a transactional outbox needs. Pure: no connection, no logging, no
 * framework.
 *
 * Returns undefined when the payload is over the limit (it must be under
 * 8000 bytes; see {@link PG_NOTIFY_MAX_PAYLOAD_BYTES}) and
 * `onOversized` is absent, returns undefined, or returns a replacement that is
 * itself over the limit. The caller decides whether that is worth logging.
 *
 * Throws for a channel Postgres would reject (empty, over 63 bytes, or
 * containing NUL), so the mistake surfaces here rather than as a failed
 * statement that aborts the caller's transaction.
 */
export function buildNotifyQuery(
  channel: string,
  payload: string,
  options?: NotifyPayloadOptions,
): NotifyQuery | undefined {
  assertNotifyChannel(channel);
  const fitted = fitNotifyPayload(channel, payload, options);
  if (!fitted.sent) return undefined;

  return {
    text: 'SELECT pg_notify($1, $2)',
    values: [channel, fitted.payload],
    channel,
    payload: fitted.payload,
  };
}

/**
 * Sends one notification on the caller's own connection.
 *
 * Pass the client your transaction runs on (the `PoolClient` you issued BEGIN
 * on, not the pool), and the notification is delivered when that transaction
 * commits and discarded if it rolls back. Outside a transaction it is
 * delivered immediately.
 *
 * Resolves to false, without querying, when the payload is dropped for size
 * (see {@link buildNotifyQuery}); true once the statement has run.
 */
export async function notifyInTransaction(
  client: NotifyQueryable,
  channel: string,
  payload: string,
  options?: NotifyPayloadOptions,
): Promise<boolean> {
  const query = buildNotifyQuery(channel, payload, options);
  if (!query) return false;

  await client.query(query.text, query.values);
  return true;
}

export function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

/** @internal Throws for a channel name pg_notify would reject. */
export function assertNotifyChannel(channel: string): void {
  if (typeof channel !== 'string' || channel === '') {
    throw new Error('A NOTIFY channel name cannot be empty');
  }
  if (channel.includes('\0')) {
    throw new Error('A NOTIFY channel name cannot contain a NUL character');
  }
  const bytes = byteLength(channel);
  if (bytes > PG_MAX_IDENTIFIER_BYTES) {
    throw new Error(
      `NOTIFY channel ${JSON.stringify(channel)} is ${bytes} bytes; Postgres allows at most ${PG_MAX_IDENTIFIER_BYTES}`,
    );
  }
}
