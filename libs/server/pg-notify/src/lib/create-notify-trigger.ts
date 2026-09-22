import type { QueryRunner } from 'typeorm';

export interface CreateNotifyTriggerOptions {
  /** Table the trigger fires on. */
  table: string;

  /** NOTIFY channel the payload is sent to. */
  channel: string;

  /**
   * Columns included in the JSON payload, taken from the affected row.
   *
   * Keep it small. Postgres rejects a NOTIFY payload over 8000 bytes, and a
   * notification is a signal that something happened -- a receiver that needs
   * the whole row can read it back, and has to anyway if it cares about the
   * state after any later write.
   */
  columns: string[];

  /** Which statements fire the trigger. Defaults to INSERT only. */
  events?: ('INSERT' | 'UPDATE' | 'DELETE')[];

  /** Overrides the generated names, when one table carries several triggers. */
  functionName?: string;
  triggerName?: string;
}

const names = (options: CreateNotifyTriggerOptions) => ({
  fn: options.functionName ?? `notify_${options.table}_changed`,
  trigger: options.triggerName ?? `trg_notify_${options.table}_changed`,
});

export async function createNotifyTrigger(
  queryRunner: QueryRunner,
  options: CreateNotifyTriggerOptions,
): Promise<void> {
  const { fn, trigger } = names(options);
  const events = options.events ?? ['INSERT'];

  // DELETE exposes the removed row as OLD; everything else as NEW.
  const row = events.includes('DELETE') && events.length === 1 ? 'OLD' : 'NEW';

  const payload = options.columns
    .map((column) => `'${column}', ${row}."${column}"`)
    .join(',\n          ');

  await queryRunner.query(`
    CREATE OR REPLACE FUNCTION ${fn}()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    DECLARE
      payload JSON;
    BEGIN
      payload := json_build_object(
          ${payload}
      );
      PERFORM pg_notify('${options.channel}', payload::text);
      RETURN ${row};
    END;
    $$;
  `);

  await queryRunner.query(`
    CREATE TRIGGER ${trigger}
    AFTER ${events.join(' OR ')} ON "${options.table}"
    FOR EACH ROW
    EXECUTE FUNCTION ${fn}();
  `);
}

export async function dropNotifyTrigger(
  queryRunner: QueryRunner,
  options: CreateNotifyTriggerOptions,
): Promise<void> {
  const { fn, trigger } = names(options);

  await queryRunner.query(
    `DROP TRIGGER IF EXISTS ${trigger} ON "${options.table}"`,
  );
  await queryRunner.query(`DROP FUNCTION IF EXISTS ${fn}()`);
}
