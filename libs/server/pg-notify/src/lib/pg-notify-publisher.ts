import {
  Inject,
  Injectable,
  Logger,
  Optional,
  forwardRef,
} from '@nestjs/common';
import type { DataSource } from 'typeorm';
import {
  NotifyPayloadOptions,
  NotifyQueryable,
  PG_NOTIFY_MAX_PAYLOAD_BYTES,
  assertNotifyChannel,
  fitNotifyPayload,
} from './notify-query';

export { PG_NOTIFY_MAX_PAYLOAD_BYTES };

export type PgNotifyPublisherOptions = NotifyPayloadOptions;

/**
 * The DataSource class, resolved when Nest injects the publisher rather than
 * when this module loads, so that importing this package never loads typeorm.
 *
 * A plain `import { DataSource } from 'typeorm'` is needed for Nest to inject
 * by type, and it makes typeorm a hard runtime dependency of every consumer --
 * including those that construct the publisher themselves with a pg pool.
 */
const typeormDataSource = forwardRef(
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => require('typeorm').DataSource,
);

@Injectable()
export class PgNotifyPublisher {
  private readonly logger = new Logger(PgNotifyPublisher.name);

  /**
   * @param dataSource where notifications are sent from: a TypeORM
   *   `DataSource` (what Nest injects), or anything with `query(text, values)`
   *   such as a `pg` `Pool`. Each publish takes its own connection from it.
   */
  constructor(
    @Inject(typeormDataSource)
    private readonly dataSource: DataSource | NotifyQueryable,
    @Optional() private readonly options: PgNotifyPublisherOptions = {},
  ) {}

  /**
   * Sends one notification.
   *
   * Runs on its own connection from the pool, deliberately. `pg_notify` inside
   * a transaction delivers at COMMIT, not at call time -- so publishing on a
   * caller's transaction would hold every notification until the unit of work
   * ended, which for anything streaming defeats the point. The cost is that a
   * notification can arrive for a transaction that later rolls back; a receiver
   * that reads the row back will simply find nothing, which is the safer of the
   * two failure modes.
   *
   * To notify inside a transaction instead -- delivered only if it commits, as
   * a transactional outbox needs -- use `notifyInTransaction` or
   * `buildNotifyQuery` on the transaction's own connection.
   *
   * Rejects, without querying, for a channel Postgres would reject (empty,
   * over 63 bytes, or containing NUL).
   */
  async publish(channel: string, payload: string): Promise<void> {
    assertNotifyChannel(channel);
    const sized = this.withinLimit(channel, payload);
    if (sized === undefined) return;

    await this.dataSource.query('SELECT pg_notify($1, $2)', [channel, sized]);
  }

  async publishJson(channel: string, payload: unknown): Promise<void> {
    await this.publish(channel, JSON.stringify(payload));
  }

  private withinLimit(channel: string, payload: string): string | undefined {
    const fitted = fitNotifyPayload(channel, payload, this.options);
    if (fitted.sent) return fitted.payload;

    if (fitted.reason === 'oversized') {
      this.logger.warn(
        `Dropped a ${fitted.bytes} byte notification on "${channel}": over the ${PG_NOTIFY_MAX_PAYLOAD_BYTES} byte limit and no onOversized handler is configured`,
      );
    } else {
      this.logger.error(
        `Dropped a notification on "${channel}": onOversized returned ${fitted.bytes} bytes, still over the limit`,
      );
    }
    return undefined;
  }
}
