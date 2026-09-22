import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import createPgSubscriber, { Subscriber } from 'pg-listen';
import type { DataSource } from 'typeorm';
import { PostgresDriver } from 'typeorm/driver/postgres/PostgresDriver';

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

  constructor(
    protected readonly channel: string,
    private readonly dataSource: DataSource,
  ) {}

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
    const pgDriver = this.dataSource.driver as PostgresDriver;

    this.subscriber = createPgSubscriber({
      connectionString: pgDriver.options.url,
      host: pgDriver.options.host,
      user: pgDriver.options.username,
      password: pgDriver.options.password,
      database: pgDriver.options.database,
      port: pgDriver.options.port,
      ssl: pgDriver.options.ssl,
      connectionTimeoutMillis: pgDriver.options.connectTimeoutMS,
      application_name: pgDriver.options.applicationName,
      max: pgDriver.options.poolSize,
      retryTimeout: RETRY_TIMEOUT_MS,
      ...pgDriver.options.extra,
    });

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
