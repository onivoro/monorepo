export interface CreateNotifyTriggerOptions {
  /**
   * Table the trigger fires on.
   *
   * `'schema.table'` is read as schema-qualified, split at the first dot, unless
   * `schema` is given -- in which case `table` is taken whole, dots included.
   */
  table: string;

  /**
   * Schema of the table. The trigger function is created in the same schema.
   * Omit it to use the connection's search_path, as before.
   */
  schema?: string;

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

/** Anything that runs SQL: a TypeORM `QueryRunner`, a `pg` `Client`, ... */
export interface NotifyTriggerQueryable {
  query(sql: string): unknown;
}

const EVENTS = new Set(['INSERT', 'UPDATE', 'DELETE']);

/**
 * Quotes a Postgres identifier: wrapped in double quotes, embedded double
 * quotes doubled. The result is always taken literally, case included.
 */
export function quotePgIdentifier(name: string): string {
  assertSqlText(name, 'identifier');
  if (name === '') throw new Error('A Postgres identifier cannot be empty');
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Quotes a Postgres string literal, as Postgres' own `quote_literal` does:
 * single quotes doubled, and an `E'...'` literal with doubled backslashes when
 * the value has any, so it reads the same whatever standard_conforming_strings
 * is set to.
 */
export function quotePgLiteral(value: string): string {
  assertSqlText(value, 'string literal');
  const quoted = value.replace(/'/g, "''");
  return value.includes('\\')
    ? `E'${quoted.replace(/\\/g, '\\\\')}'`
    : `'${quoted}'`;
}

/**
 * The SQL that creates the trigger function and the trigger, as one script of
 * two semicolon-terminated statements -- ready to paste into, or generate, a
 * versioned migration file. Needs no connection.
 */
export function buildNotifyTriggerSql(
  options: CreateNotifyTriggerOptions,
): string {
  return script(createStatements(options));
}

/** The SQL that drops what {@link buildNotifyTriggerSql} creates. */
export function buildDropNotifyTriggerSql(
  options: CreateNotifyTriggerOptions,
): string {
  return script(dropStatements(options));
}

export async function createNotifyTrigger(
  queryRunner: NotifyTriggerQueryable,
  options: CreateNotifyTriggerOptions,
): Promise<void> {
  for (const statement of createStatements(options)) {
    await queryRunner.query(statement);
  }
}

export async function dropNotifyTrigger(
  queryRunner: NotifyTriggerQueryable,
  options: CreateNotifyTriggerOptions,
): Promise<void> {
  for (const statement of dropStatements(options)) {
    await queryRunner.query(statement);
  }
}

function createStatements(options: CreateNotifyTriggerOptions): string[] {
  const { table, fn, trigger } = names(options);
  const events = [...new Set(options.events ?? ['INSERT'])];

  for (const event of events) {
    if (!EVENTS.has(event)) {
      throw new Error(
        `Unsupported trigger event ${JSON.stringify(event)}: use INSERT, UPDATE or DELETE`,
      );
    }
  }
  if (events.length === 0) {
    throw new Error('A notify trigger needs at least one event');
  }

  // DELETE exposes the removed row as OLD; everything else as NEW.
  const row = events.includes('DELETE') && events.length === 1 ? 'OLD' : 'NEW';

  const payload = options.columns
    .map(
      (column) =>
        `${quotePgLiteral(column)}, ${row}.${quotePgIdentifier(column)}`,
    )
    .join(',\n          ');

  const body = `
    DECLARE
      payload JSON;
    BEGIN
      payload := json_build_object(
          ${payload}
      );
      PERFORM pg_notify(${quotePgLiteral(options.channel)}, payload::text);
      RETURN ${row};
    END;
    `;

  // The body is dollar-quoted. A column or channel containing the tag would
  // end the quote early, so pick a tag that does not occur in it.
  const tag = dollarTag(body);

  return [
    `CREATE OR REPLACE FUNCTION ${fn}()
    RETURNS TRIGGER LANGUAGE plpgsql AS ${tag}${body}${tag}`,
    `CREATE TRIGGER ${trigger}
    AFTER ${events.join(' OR ')} ON ${table}
    FOR EACH ROW
    EXECUTE FUNCTION ${fn}()`,
  ];
}

function dropStatements(options: CreateNotifyTriggerOptions): string[] {
  const { table, fn, trigger } = names(options);

  return [
    `DROP TRIGGER IF EXISTS ${trigger} ON ${table}`,
    `DROP FUNCTION IF EXISTS ${fn}()`,
  ];
}

function names(options: CreateNotifyTriggerOptions) {
  let schema = options.schema;
  let table = options.table;

  if (schema === undefined && table.includes('.')) {
    const dot = table.indexOf('.');
    schema = table.slice(0, dot);
    table = table.slice(dot + 1);
  }

  const qualify = (name: string) =>
    schema === undefined
      ? quotePgIdentifier(name)
      : `${quotePgIdentifier(schema)}.${quotePgIdentifier(name)}`;

  return {
    table: qualify(table),
    fn: qualify(routineName(options.functionName ?? `notify_${table}_changed`)),
    trigger: quotePgIdentifier(
      routineName(options.triggerName ?? `trg_notify_${table}_changed`),
    ),
  };
}

/**
 * Function and trigger names were emitted unquoted before, so Postgres folded
 * them to lower case: a table `Outbox` got `notify_outbox_changed`. Folding the
 * names that were valid unquoted keeps those exact objects, so a down
 * migration written against an earlier version still finds what it created.
 * Anything else -- which could not have worked unquoted -- is taken literally.
 */
function routineName(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_$]*$/.test(name)
    ? name.replace(/[A-Z]/g, (c) => c.toLowerCase())
    : name;
}

function dollarTag(body: string): string {
  let tag = '$notify$';
  for (let i = 1; body.includes(tag); i++) tag = `$notify${i}$`;
  return tag;
}

function script(statements: string[]): string {
  return statements.map((statement) => `${statement};\n`).join('\n');
}

function assertSqlText(value: string, what: string) {
  if (typeof value !== 'string') {
    throw new TypeError(`A Postgres ${what} must be a string`);
  }
  if (value.includes('\0')) {
    throw new Error(`A Postgres ${what} cannot contain a NUL character`);
  }
}
