import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import createPgSubscriber, { Subscriber } from 'pg-listen';
import type { DataSource } from 'typeorm';
import type { PostgresDriver } from 'typeorm/driver/postgres/PostgresDriver';
import { assertNotifyChannel } from './notify-query';

/**
 * node-postgres connection settings: `pg`'s `ClientConfig` (host, port, user,
 * password, database, ssl, connectionString, ...), as pg-listen takes them.
 */
export type PgClientConfig = NonNullable<
  Parameters<typeof createPgSubscriber>[0]
>;

/**
 * Where a NotificationListener connects: a TypeORM DataSource using the
 * Postgres driver, a node-postgres config object, or a connection string.
 */
export type NotificationListenerConnection =
  | DataSource
  | PgClientConfig
  | string;

/** pg-listen's own options, which it reads from its second argument. */
const PG_LISTEN_OPTION_KEYS = [
  'retryTimeout',
  'retryInterval',
  'retryLimit',
  'paranoidChecking',
] as const;

/**
 * How long pg-listen keeps trying before it gives up and emits `error`.
 *
 * Its default is 3000ms, which is shorter than most things that interrupt a
 * database connection: a bastion tunnel dropping, a failover, a deploy. Six
 * attempts at 500ms and it is done — so the ordinary case was reaching the
 * give-up path rather than reconnecting through it.
 */
const RETRY_TIMEOUT_MS = 30_000;

/** Backoff for OUR re-initialisation, after pg-listen has given up entirely. */
const REINIT_MIN_MS = 1_000;
const REINIT_MAX_MS = 30_000;

/**
 * A pg LISTEN/NOTIFY subscription that survives losing its connection.
 *
 * It did not. pg-listen emits `error` on its own EventEmitter when reconnection
 * fails, and nothing subscribed to it — an unhandled 'error' event is a process
 * crash in Node, so the whole API died:
 *
 *   Error: Re-initializing the PostgreSQL notification client after connection
 *   loss failed: Stopping PostgreSQL reconnection attempts after 3000ms timeout
 *   has been reached.
 *
 * Under a supervisor that is a crash loop, and every request in flight dies with
 * it, over a subscription that is not on the request path at all.
 *
 * The fix is three things, and the third is the one that is easy to miss.
 * Handling the error stops the crash. Raising the retry window means an ordinary
 * blip reconnects rather than reaching the give-up path. And re-initialising
 * afterwards means the process that no longer crashes is not silently deaf
 * instead — trading a loud failure for a quiet one would be no trade at all,
 * because a crash at least restarts into a working listener.
 */
export abstract class NotificationListener<TNotification>
  implements OnModuleInit, OnModuleDestroy
{
  private subscriber?: Subscriber;
  private reinitTimer?: ReturnType<typeof setTimeout>;
  private reinitAttempt = 0;
  private stopping = false;

  /**
   * One stable reference for the lifetime of this listener.
   *
   * `this.onNotification.bind(this)` returns a NEW function every call, so the
   * old teardown passed removeListener something it had never added and removed
   * nothing.
   */
  private readonly boundOnNotification = (payload: TNotification) =>
    this.onNotification(payload);

  private readonly logger = new Logger(NotificationListener.name);

  /**
   * @param channel the channel to LISTEN on.
   * @param connection a TypeORM `DataSource` (Postgres driver), node-postgres
   *   connection settings, or a connection string. The listener holds its own
   *   dedicated connection either way; typeorm is never loaded for the latter
   *   two.
   * @throws for a channel Postgres cannot carry (empty, over 63 bytes, or
   *   containing NUL). LISTEN would quietly truncate a long one and listen on
   *   a channel nothing sends to.
   */
  constructor(
    protected readonly channel: string,
    private readonly connection: NotificationListenerConnection,
  ) {
    assertNotifyChannel(channel);
  }

  async onModuleInit() {
    // Deliberately not caught. A database that is unreachable at boot should
    // fail the boot: starting without the subscription would leave an app that
    // looks healthy and receives nothing.
    await this.subscribe();
  }

  async onModuleDestroy() {
    this.stopping = true;

    if (this.reinitTimer) {
      clearTimeout(this.reinitTimer);
      this.reinitTimer = undefined;
    }

    await this.teardown();

    this.logger.log(`Unlistening to pg "${this.channel}" notifications`);
  }

  private async subscribe() {
    this.subscriber = createPgSubscriber(...subscriberArgs(this.connection));

    // Registered BEFORE connect. pg-listen can emit during connection, and an
    // error arriving before the handler exists is the crash this prevents.
    this.subscriber.events.on('error', (error: Error) =>
      this.onSubscriberError(error),
    );
    this.subscriber.events.on('reconnect', (attempt: number) => {
      this.logger.warn(
        `Reconnecting to pg "${this.channel}" notifications (attempt ${attempt})`,
      );
    });

    await this.subscriber.connect();
    await this.subscriber.listenTo(this.channel);
    this.subscriber.notifications.addListener(
      this.channel,
      this.boundOnNotification,
    );

    this.reinitAttempt = 0;

    this.logger.log(`Listening to pg "${this.channel}" notifications`);
  }

  /**
   * pg-listen has exhausted its own retries.
   *
   * Logged rather than thrown — throwing from an event handler is the crash
   * again — and then re-initialised from scratch, because at this point the
   * subscriber will not recover on its own.
   */
  private onSubscriberError(error: Error) {
    this.logger.error(
      `pg "${this.channel}" notification client failed: ${error?.message}`,
    );

    this.scheduleReinit();
  }

  /**
   * Never gives up, and never runs two at once.
   *
   * Bounded attempts would end in a process that is running and permanently
   * deaf, which is the failure nobody notices. The backoff is capped so a
   * database that is down for an hour is retried every 30s rather than
   * hammered.
   */
  private scheduleReinit() {
    if (this.stopping || this.reinitTimer) {
      return;
    }

    const delay = Math.min(
      REINIT_MIN_MS * 2 ** this.reinitAttempt++,
      REINIT_MAX_MS,
    );

    this.reinitTimer = setTimeout(async () => {
      this.reinitTimer = undefined;

      if (this.stopping) {
        return;
      }

      try {
        await this.teardown();
        await this.subscribe();
      } catch (retryError: any) {
        this.logger.error(
          `could not re-establish pg "${this.channel}" notifications: ${retryError?.message}`,
        );

        this.scheduleReinit();
      }
    }, delay);
  }

  /** Best effort: a subscriber that is already broken will throw on the way out. */
  private async teardown() {
    const subscriber = this.subscriber;
    this.subscriber = undefined;

    if (!subscriber) {
      return;
    }

    try {
      subscriber.notifications.removeListener(
        this.channel,
        this.boundOnNotification,
      );
      await subscriber.unlisten(this.channel);
      await subscriber.close();
    } catch {
      // Closing a dead connection failing is not news, and letting it propagate
      // would take down shutdown or the retry that is trying to replace it.
    }
  }

  abstract onNotification(payload: TNotification): void | Promise<void>;
}

/**
 * pg-listen's two arguments: the pg connection config, and its own options.
 *
 * The retry settings belong in the second. They used to be spread into the
 * first along with the connection settings, where pg-listen never looks, so
 * the 30s retry window silently stayed at its 3s default. Retry keys found in
 * the connection settings (typeorm `extra`, or the pg config) are still
 * honoured -- moved to where pg-listen reads them.
 */
function subscriberArgs(
  connection: NotificationListenerConnection,
): [PgClientConfig, Record<string, unknown>] {
  const config: Record<string, unknown> =
    typeof connection === 'string'
      ? { connectionString: connection }
      : isDataSource(connection)
        ? fromDataSource(connection)
        : { ...connection };

  const options: Record<string, unknown> = { retryTimeout: RETRY_TIMEOUT_MS };
  for (const key of PG_LISTEN_OPTION_KEYS) {
    if (config[key] !== undefined) options[key] = config[key];
    delete config[key];
  }

  return [config as PgClientConfig, options];
}

function isDataSource(
  connection: Exclude<NotificationListenerConnection, string>,
): connection is DataSource {
  const driver = (connection as { driver?: { options?: unknown } }).driver;
  return typeof driver === 'object' && driver !== null && 'options' in driver;
}

function fromDataSource(dataSource: DataSource): Record<string, unknown> {
  const { options } = dataSource.driver as PostgresDriver;

  return {
    connectionString: options.url,
    host: options.host,
    user: options.username,
    password: options.password,
    database: options.database,
    port: options.port,
    ssl: options.ssl,
    connectionTimeoutMillis: options.connectTimeoutMS,
    application_name: options.applicationName,
    max: options.poolSize,
    ...options.extra,
  };
}
