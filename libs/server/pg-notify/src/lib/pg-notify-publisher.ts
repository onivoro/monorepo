import { Injectable, Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';

/**
 * Postgres caps a NOTIFY payload at 8000 bytes and rejects anything larger,
 * failing the statement rather than truncating.
 */
export const PG_NOTIFY_MAX_PAYLOAD_BYTES = 8000;

export interface PgNotifyPublisherOptions {
  /**
   * What to send when a payload will not fit.
   *
   * Returning a smaller envelope -- an id the receiver can use to read the row
   * itself -- keeps delivery working for large events. Returning undefined
   * drops the notification, which is logged.
   */
  onOversized?: (payload: string, channel: string) => string | undefined;
}

@Injectable()
export class PgNotifyPublisher {
  private readonly logger = new Logger(PgNotifyPublisher.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly options: PgNotifyPublisherOptions = {},
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
   */
  async publish(channel: string, payload: string): Promise<void> {
    const sized = this.withinLimit(channel, payload);
    if (sized === undefined) return;

    await this.dataSource.query('SELECT pg_notify($1, $2)', [channel, sized]);
  }

  async publishJson(channel: string, payload: unknown): Promise<void> {
    await this.publish(channel, JSON.stringify(payload));
  }

  private withinLimit(channel: string, payload: string): string | undefined {
    if (byteLength(payload) <= PG_NOTIFY_MAX_PAYLOAD_BYTES) return payload;

    const fallback = this.options.onOversized?.(payload, channel);

    if (fallback === undefined) {
      this.logger.warn(
        `Dropped a ${byteLength(payload)} byte notification on "${channel}": over the ${PG_NOTIFY_MAX_PAYLOAD_BYTES} byte limit and no onOversized handler is configured`,
      );
      return undefined;
    }

    if (byteLength(fallback) > PG_NOTIFY_MAX_PAYLOAD_BYTES) {
      this.logger.error(
        `Dropped a notification on "${channel}": onOversized returned ${byteLength(fallback)} bytes, still over the limit`,
      );
      return undefined;
    }

    return fallback;
  }
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}
