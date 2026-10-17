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

/**
 * Where a NotificationListener logs. Nest's `Logger` and `console` both fit.
 */
export interface NotificationListenerLogger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface NotificationListenerOptions<TNotification> {
  /**
   * Where to log: connecting, losing the connection, re-establishing it, and
   * payloads or handlers that fail. `false` logs nothing. Default: `console`,
   * prefixed `[NotificationListener]`, from `@onivoro/server-pg-notify/listener`;
   * Nest's `Logger` (context `NotificationListener`) from the package's main
   * entry point.
   */
  logger?: NotificationListenerLogger | false;
  /**
   * Turns each payload, as Postgres delivered it, into what `onNotification`
   * gets. Default: `JSON.parse`. When it throws, `onBadPayload` gets the raw
   * payload and the notification is skipped; the connection is kept.
   *
   * It is only called for a non-empty payload. Postgres delivers `NOTIFY ch`
   * and `NOTIFY ch, ''` alike, as an empty payload, and either reaches
   * `onNotification` as `undefined`, without calling `parse`.
   */
  parse?: (raw: string) => TNotification;
}

/** What `onListening` is told. */
export interface NotificationListenerListening {
  /**
   * `false` for the first LISTEN; `true` for every one after the connection
   * was lost. Notifications sent while it was lost were not delivered, so
   * re-read whatever they would have told you.
   */
  reconnected: boolean;
}

/** pg-listen's own options, which it reads from its second argument. */
const PG_LISTEN_RETRY_KEYS = [
  'retryTimeout',
  'retryInterval',
  'retryLimit',
] as const;
const PG_LISTEN_OPTION_KEYS = [
  ...PG_LISTEN_RETRY_KEYS,
  'paranoidChecking',
] as const;

/**
 * How long pg-listen keeps trying, when it is asked to retry at all (by
 * setting one of its retry options).
 *
 * Its default is 3000ms, which is shorter than most things that interrupt a
 * database connection: a bastion tunnel dropping, a failover, a deploy.
 */
const RETRY_TIMEOUT_MS = 30_000;

/** Backoff for the listener's own re-initialisation. */
const REINIT_MIN_MS = 1_000;
const REINIT_MAX_MS = 30_000;

/**
 * What `onBadPayload` is given when `parse` throws. Its message never includes
 * the payload (`JSON.parse`'s own message quotes it), so it is safe to log;
 * the payload itself is only the hook's `raw` argument.
 */
export class NotificationPayloadError extends Error {
  override readonly name = 'NotificationPayloadError';
  /** The name of what `parse` threw, such as `SyntaxError`. */
  readonly parseErrorName: string;

  // Nothing is read from the parser's message: JSON.parse's quotes the payload,
  // so anything taken from it (even a "position") could be the payload's text.
  constructor(channel: string, raw: string, error: unknown) {
    const parseErrorName = error instanceof Error ? error.name : typeof error;
    super(
      `a pg "${channel}" notification payload (${raw.length} characters) could not be parsed: ${parseErrorName}`,
    );
    this.parseErrorName = parseErrorName;
  }
}

/** Thrown into an in-flight subscribe that the listener has given up on. */
class SubscriptionAbandoned extends Error {
  constructor(channel: string) {
    super(`the pg "${channel}" listener was closed while connecting`);
  }
}

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
 * Handling the error stops the crash. Owning the retries means one loop, which
 * stops when the listener is closed (pg-listen's own loop can't be stopped once
 * it starts). And re-initialising after every loss means the process that no
 * longer crashes is not silently deaf instead — trading a loud failure for a
 * quiet one would be no trade at all, because a crash at least restarts into a
 * working listener.
 *
 * It needs no Nest: `onModuleInit` and `onModuleDestroy` are plain methods Nest
 * happens to call. Import it from `@onivoro/server-pg-notify/listener` to load
 * neither Nest nor typeorm: this class never imports Nest, and logs to
 * `console` by default. The main entry point's `NotificationListener` is a
 * subclass that logs through Nest's `Logger` by default.
 */
export abstract class NotificationListener<TNotification> {
  private subscriber?: Subscriber;
  // What's new is #private, so that it can't collide with a subclass's own members.
  /** The subscribe in progress, so that closing can wait for it. */
  #subscribing?: Promise<void>;
  /** Retries in progress (teardown, then subscribe), so that closing can wait for them. */
  readonly #retrying = new Set<Promise<void>>();
  private reinitTimer?: ReturnType<typeof setTimeout>;
  private reinitAttempt = 0;
  private stopping = false;
  #listening = false;
  #everListened = false;

  /**
   * One stable reference for the lifetime of this listener.
   *
   * `this.onNotification.bind(this)` returns a NEW function every call, so the
   * old teardown passed removeListener something it had never added and removed
   * nothing.
   */
  private readonly boundOnNotification = (raw: unknown) => this.#deliver(raw);

  private readonly logger?: NotificationListenerLogger;
  readonly #parse: (raw: string) => TNotification;

  /**
   * @param channel the channel to LISTEN on.
   * @param connection a TypeORM `DataSource` (Postgres driver), node-postgres
   *   connection settings, or a connection string. The listener holds its own
   *   dedicated connection either way; typeorm is never loaded for the latter
   *   two.
   * @param options where to log, and how to parse payloads.
   * @throws for a channel Postgres cannot carry (empty, over 63 bytes, or
   *   containing NUL). LISTEN would quietly truncate a long one and listen on
   *   a channel nothing sends to.
   */
  constructor(
    protected readonly channel: string,
    private readonly connection: NotificationListenerConnection,
    options: NotificationListenerOptions<TNotification> = {},
  ) {
    assertNotifyChannel(channel);
    this.logger =
      options.logger === false
        ? undefined
        : (options.logger ?? consoleLogger('NotificationListener'));
    this.#parse = options.parse ?? ((raw) => JSON.parse(raw) as TNotification);
  }

  /**
   * Whether the subscription is in place now: true from each successful
   * LISTEN until the connection is next lost or the listener is closed.
   * Notifications sent while it is false are not delivered.
   */
  get isListening(): boolean {
    return this.#listening;
  }

  /**
   * Opens the subscription, and resolves once the LISTEN is in place.
   *
   * Deliberately not caught: a database that is unreachable at boot should
   * fail the boot, since starting without the subscription would leave an app
   * that looks healthy and receives nothing. It leaves nothing behind when it
   * rejects: no connection, and no retry scheduled.
   */
  async onModuleInit() {
    try {
      await this.subscribe();
    } catch (error) {
      this.#cancelReinit();
      await this.teardown();
      throw error;
    }
  }

  /**
   * Closes the subscription. No retry starts after this, and one in progress
   * (its teardown or its subscribe) is waited for, and what it opened closed.
   */
  async onModuleDestroy() {
    this.stopping = true;
    this.#listening = false;
    this.#cancelReinit();

    // Closing the connection makes a connect in progress fail rather than
    // hang; then wait for that subscribe and any retry, and close whatever
    // they left.
    await this.teardown();
    await Promise.all(
      [this.#subscribing, ...this.#retrying].map((step) =>
        step?.catch(() => undefined),
      ),
    );
    await this.teardown();

    this.logger?.log(`Unlistening to pg "${this.channel}" notifications`);
  }

  abstract onNotification(payload: TNotification): void | Promise<void>;

  /**
   * Called after every LISTEN that succeeds: the first, with
   * `{ reconnected: false }`, and each one after the connection was lost,
   * with `{ reconnected: true }`. Notifications sent while it was lost were
   * not delivered, so re-read what they would have said here. What it throws
   * (or rejects with) is logged.
   */
  protected onListening(
    _event: NotificationListenerListening,
  ): void | Promise<void> {
    return undefined;
  }

  /**
   * Called when the connection is lost, before any retry. `isListening` is
   * already false. Notifications are missed until the next `onListening`.
   * It may be async. What it throws or rejects with is logged.
   */
  protected onConnectionLost(_error: Error): void | Promise<void> {
    return undefined;
  }

  /**
   * Called for a payload `parse` rejects, instead of `onNotification`. The
   * connection is kept. By default it logs a warning, without the payload,
   * which anyone who can connect to the database can write.
   *
   * `error` is a `NotificationPayloadError`, whose message says the payload's
   * length and where parsing failed but never quotes it, so it is safe to log.
   * The payload is `raw`; log that only if you trust every writer.
   *
   * It may be async. What it throws or rejects with is logged by its name
   * only, since it has the payload.
   */
  protected onBadPayload(
    raw: string,
    _error: NotificationPayloadError,
  ): void | Promise<void> {
    this.logger?.warn(
      `Ignored a pg "${this.channel}" notification whose payload (${raw.length} characters) could not be parsed`,
    );
  }

  private subscribe(): Promise<void> {
    const subscribing = this.#connectAndListen();
    this.#subscribing = subscribing;
    const settled = () => {
      if (this.#subscribing === subscribing) this.#subscribing = undefined;
    };
    subscribing.then(settled, settled);
    return subscribing;
  }

  async #connectAndListen() {
    const subscriber = createPgSubscriber(...subscriberArgs(this.connection));
    this.subscriber = subscriber;
    let listenedOnce = false;

    // Registered BEFORE connect. pg-listen can emit during connection, and an
    // error arriving before the handler exists is the crash this prevents.
    subscriber.events.on('error', (error: Error) =>
      this.onSubscriberError(subscriber, error),
    );
    subscriber.events.on('reconnect', (attempt: number) =>
      this.#onSubscriberReconnecting(subscriber, attempt),
    );
    // pg-listen emits `connected` from connect(), before the LISTEN, and again
    // after each reconnect of its own, once it has re-run the LISTEN.
    subscriber.events.on('connected', () => {
      if (this.stopping || this.subscriber !== subscriber) {
        // A connection pg-listen made after it was closed or replaced.
        subscriber.close().catch(() => undefined);
        return;
      }
      if (listenedOnce) this.#listened();
    });

    await subscriber.connect();
    this.#assertCurrent(subscriber);
    await subscriber.listenTo(this.channel);
    this.#assertCurrent(subscriber);
    subscriber.notifications.addListener(
      this.channel,
      this.boundOnNotification,
    );
    listenedOnce = true;
    this.#listened();
  }

  /** The listener was closed, or gave up on this subscriber, meanwhile. */
  #assertCurrent(subscriber: Subscriber) {
    if (this.stopping || this.subscriber !== subscriber) {
      throw new SubscriptionAbandoned(this.channel);
    }
  }

  #listened() {
    this.reinitAttempt = 0;
    this.#listening = true;
    const reconnected = this.#everListened;
    this.#everListened = true;

    this.logger?.log(
      reconnected
        ? `Listening to pg "${this.channel}" notifications again`
        : `Listening to pg "${this.channel}" notifications`,
    );

    this.#runHook(
      () => this.onListening({ reconnected }),
      (error) => this.#logHookError('onListening', error),
    );
  }

  /**
   * The connection is lost, or a connect failed. pg-listen makes no attempt
   * of its own unless asked to (see subscriberArgs), so this is where every
   * retry starts.
   *
   * Logged rather than thrown — throwing from an event handler is the crash
   * again — and then re-initialised from scratch.
   */
  private onSubscriberError(subscriber: Subscriber, error: Error) {
    if (this.stopping || this.subscriber !== subscriber) return;

    this.logger?.error(
      `pg "${this.channel}" notification client failed: ${error?.message}`,
    );
    this.#lost(error);
    this.scheduleReinit();
  }

  /** Only when pg-listen was asked to retry: it lost the connection and is reconnecting. */
  #onSubscriberReconnecting(subscriber: Subscriber, attempt: number) {
    if (this.stopping || this.subscriber !== subscriber) return;

    this.logger?.warn(
      `Reconnecting to pg "${this.channel}" notifications (attempt ${attempt})`,
    );
    this.#lost(new Error('the connection was lost; pg-listen is reconnecting'));
  }

  #lost(error: Error) {
    if (!this.#listening) return;
    this.#listening = false;
    this.#runHook(
      () => this.onConnectionLost(error),
      (hookError) => this.#logHookError('onConnectionLost', hookError),
    );
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

    this.reinitTimer = setTimeout(() => {
      this.reinitTimer = undefined;

      if (this.stopping) {
        return;
      }

      const retry = this.#retry();
      this.#retrying.add(retry);
      void retry.finally(() => this.#retrying.delete(retry));
    }, delay);
  }

  /** One retry: tear the old subscriber down, then subscribe again. */
  async #retry() {
    try {
      await this.teardown();
      // Closed while the old connection was closing: don't open a new one.
      if (this.stopping) return;
      await this.subscribe();
    } catch (retryError: any) {
      // Closed, or a newer retry replaced this subscriber (and owns what
      // happens next): not a failure of this retry.
      if (this.stopping || retryError instanceof SubscriptionAbandoned) return;

      this.logger?.error(
        `could not re-establish pg "${this.channel}" notifications: ${retryError?.message}`,
      );

      this.scheduleReinit();
    }
  }

  #cancelReinit() {
    if (this.reinitTimer) {
      clearTimeout(this.reinitTimer);
      this.reinitTimer = undefined;
    }
  }

  /** Best effort: a subscriber that is already broken will throw on the way out. */
  private async teardown() {
    const subscriber = this.subscriber;
    this.subscriber = undefined;
    this.#listening = false;

    if (!subscriber) {
      return;
    }

    try {
      subscriber.notifications.removeListener(
        this.channel,
        this.boundOnNotification,
      );
      await subscriber.unlisten(this.channel);
    } catch {
      // Unlistening on a dead connection failing is not news.
    }
    try {
      await subscriber.close();
    } catch {
      // Nor is closing one, and letting it propagate would take down shutdown
      // or the retry that is trying to replace it.
    }
  }

  /**
   * Parses and hands over one notification. pg calls this from its socket
   * handler, where a throw would end the process, so nothing escapes: a bad
   * payload goes to onBadPayload, and what onNotification throws or rejects
   * with is logged by its name only, since its message may quote the payload.
   */
  #deliver(raw: unknown) {
    let payload: TNotification;
    if (typeof raw === 'string') {
      try {
        payload = this.#parse(raw);
      } catch (error) {
        this.#runHook(
          () =>
            this.onBadPayload(
              raw,
              new NotificationPayloadError(this.channel, raw, error),
            ),
          // It has the payload, so its message may quote it.
          (hookError) =>
            this.logger?.error(
              `onBadPayload failed for pg "${this.channel}" notifications: ${errorName(hookError)}`,
            ),
        );
        return;
      }
    } else {
      payload = raw as TNotification;
    }

    this.#runHook(
      () => this.onNotification(payload),
      (error) => this.#logNotificationError(error),
    );
  }

  /**
   * By the error's name only: a validation error (zod, class-validator) often
   * quotes the values it rejected, which anyone who can NOTIFY can write. Catch
   * inside onNotification to log more.
   */
  #logNotificationError(error: unknown) {
    this.logger?.error(
      `A pg "${this.channel}" notification failed in onNotification: ${errorName(error)}`,
    );
  }

  /**
   * Runs a hook so that nothing it throws, or rejects with if it is async,
   * escapes: pg-listen calls these from event handlers, where a throw or an
   * unhandled rejection would end the process.
   */
  #runHook(hook: () => unknown, onError: (error: unknown) => void) {
    const report = (error: unknown) => {
      try {
        onError(error);
      } catch {
        // A logger that throws can't be helped here.
      }
    };
    try {
      const result = hook();
      if (isPromiseLike(result)) result.then(undefined, report);
    } catch (error) {
      report(error);
    }
  }

  #logHookError(hook: string, error: unknown) {
    this.logger?.error(
      `${hook} failed for pg "${this.channel}" notifications: ${asError(error).message}`,
    );
  }
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return !!value && typeof (value as PromiseLike<unknown>).then === 'function';
}

/** `console`, with the context as a prefix. */
function consoleLogger(context: string): NotificationListenerLogger {
  return {
    log: (message) => console.log(`[${context}] ${message}`),
    warn: (message) => console.warn(`[${context}] ${message}`),
    error: (message) => console.error(`[${context}] ${message}`),
  };
}

/**
 * pg-listen's two arguments: the pg connection config, and its own options.
 *
 * By default pg-listen gets `retryLimit: 1`, so it makes no attempt of its own
 * and reports a lost connection at once; the listener owns every retry. Its
 * loop can't be stopped once started (it never checks whether it was closed),
 * so a listener closed while it ran would go on connecting.
 *
 * Retry keys found in the connection settings (typeorm `extra`, or the pg
 * config) are still honoured, as before: moved to where pg-listen reads them,
 * with its retry window raised to 30s unless they set one. They hand
 * reconnecting back to pg-listen, which the listener then follows (and still
 * re-initialises after, when pg-listen gives up).
 *
 * Payloads always reach the listener unparsed, so that a payload which isn't
 * JSON is the listener's to handle, not a connection error.
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

  const retries = PG_LISTEN_RETRY_KEYS.some((key) => config[key] !== undefined);
  const options: Record<string, unknown> = retries
    ? { retryTimeout: RETRY_TIMEOUT_MS }
    : { retryLimit: 1 };
  for (const key of PG_LISTEN_OPTION_KEYS) {
    if (config[key] !== undefined) options[key] = config[key];
    delete config[key];
  }
  options['parse'] = (raw: string) => raw;

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
