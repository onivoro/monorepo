import { PG_MAX_IDENTIFIER_BYTES, assertNotifyChannel } from './notify-query';

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

  /**
   * Overrides the generated names, when one table carries several triggers.
   *
   * Read as SQL names, as earlier versions (which emitted them unquoted) had
   * Postgres read them: `app.notify_outbox` is function `notify_outbox` in
   * schema `app`, a plain part is lowercased, and a double-quoted part such as
   * `"MyFn"` is taken literally. A name that does not parse that way is used
   * whole, as one literal identifier. A trigger name cannot be qualified.
   */
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
 *
 * Throws for a name over 63 bytes, which Postgres would otherwise truncate
 * without error -- so two long names sharing a prefix would silently become
 * the same object. (The trigger builders do not use this strict check: they
 * truncate long names as Postgres does, with {@link truncatePgIdentifier}, so
 * migrations written against earlier versions keep working.)
 */
export function quotePgIdentifier(name: string): string {
  assertSqlText(name, 'identifier');
  if (name === '') throw new Error('A Postgres identifier cannot be empty');
  assertIdentifierLength(name);
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Shortens a name exactly as Postgres does an identifier that is too long: to
 * at most 63 bytes (NAMEDATALEN - 1) of UTF-8, cut on a character boundary
 * (pg_mbcliplen), so the result can be shorter than 63 bytes when the cut
 * would fall inside a multi-byte character. Shorter names are returned as is.
 */
export function truncatePgIdentifier(name: string): string {
  if (Buffer.byteLength(name, 'utf8') <= PG_MAX_IDENTIFIER_BYTES) return name;

  let out = '';
  let bytes = 0;
  for (const char of name) {
    const size = Buffer.byteLength(char, 'utf8');
    if (bytes + size > PG_MAX_IDENTIFIER_BYTES) break;
    out += char;
    bytes += size;
  }
  return out;
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
  await runAll(queryRunner, createStatements(options));
}

export async function dropNotifyTrigger(
  queryRunner: NotifyTriggerQueryable,
  options: CreateNotifyTriggerOptions,
): Promise<void> {
  await runAll(queryRunner, dropStatements(options));
}

async function runAll(
  queryRunner: NotifyTriggerQueryable,
  statements: string[],
): Promise<void> {
  for (const statement of statements) {
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

  assertNotifyChannel(options.channel);

  const payload = options.columns
    .map(
      (column) => `${quotePgLiteral(column)}, notify_row.${quoteName(column)}`,
    )
    .join(',\n          ');

  // The row is chosen at run time: OLD for a DELETE (NEW is not bound there,
  // or is NULL), NEW otherwise -- so one trigger can cover deletes alongside
  // inserts and updates and still send the deleted row's values. The return
  // value of an AFTER row trigger is ignored.
  const body = `
    DECLARE
      notify_row RECORD;
    BEGIN
      IF TG_OP = 'DELETE' THEN
        notify_row := OLD;
      ELSE
        notify_row := NEW;
      END IF;
      PERFORM pg_notify(${quotePgLiteral(options.channel)}, json_build_object(
          ${payload}
      )::text);
      RETURN NULL;
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

  const qualify = (name: string, inSchema = schema) =>
    inSchema === undefined
      ? quoteName(name)
      : `${quoteName(inSchema)}.${quoteName(name)}`;

  let fn: string;
  if (options.functionName === undefined) {
    fn = qualify(defaultName(`notify_${table}_changed`));
  } else {
    const functionName = trimSpace(options.functionName);
    const parts = sqlName(functionName);
    if (parts && parts.length > 2) {
      throw new Error(
        `functionName ${JSON.stringify(options.functionName)} has too many parts: use name or schema.name`,
      );
    }
    fn =
      parts?.length === 2
        ? qualify(parts[1], parts[0])
        : qualify(parts?.[0] ?? functionName);
  }

  let trigger: string;
  if (options.triggerName === undefined) {
    trigger = quoteName(defaultName(`trg_notify_${table}_changed`));
  } else {
    const triggerName = trimSpace(options.triggerName);
    const parts = sqlName(triggerName);
    if (parts && parts.length > 1) {
      throw new Error(
        `triggerName ${JSON.stringify(options.triggerName)} cannot be schema-qualified: a trigger lives in its table's schema`,
      );
    }
    trigger = quoteName(parts?.[0] ?? triggerName);
  }

  return { table: qualify(table), fn, trigger };
}

/**
 * A generated name: lowercased when it is a plain identifier, as Postgres
 * folded it when earlier versions emitted it unquoted (a table `Outbox` got
 * `notify_outbox_changed`), so a down migration written then still finds what
 * it created. Otherwise -- a name that could not have worked unquoted -- it is
 * taken literally.
 */
function defaultName(name: string): string {
  return PLAIN.test(name) ? fold(name) : name;
}

/**
 * Every identifier the builders emit goes through here: quoted, and cut to 63
 * bytes the way Postgres would have cut it when earlier versions emitted it,
 * so a long table's generated names resolve to the objects those versions
 * created. Long names sharing a 63-byte prefix therefore name the same object;
 * pass functionName/triggerName to keep them apart.
 */
function quoteName(name: string): string {
  return quotePgIdentifier(truncatePgIdentifier(name));
}

// Postgres' unquoted identifier: a letter, `_` or any non-ASCII character,
// then those, digits or `$`. Folding lowercases ASCII letters only, as it does
// in a UTF-8 database.
const PLAIN_PART = '[A-Za-z_\\u0080-\\uffff][A-Za-z0-9_$\\u0080-\\uffff]*';
const PLAIN = new RegExp(`^${PLAIN_PART}$`);
const PLAIN_PREFIX = new RegExp(`^${PLAIN_PART}`);
const SPACE = /[ \t\n\r\f\v]/;
const EDGE_SPACE = new RegExp(`^${SPACE.source}+|${SPACE.source}+$`, 'g');
/** Strips the whitespace SQL ignores around a name, as it did unquoted. */
const trimSpace = (name: string) => name.replace(EDGE_SPACE, '');
const fold = (name: string) => name.replace(/[A-Z]/g, (c) => c.toLowerCase());

/**
 * Splits a name the way Postgres reads an unquoted SQL name: dot-separated
 * parts, each either a plain identifier (lowercased) or a double-quoted one
 * (taken literally, `""` meaning `"`). Whitespace around the parts is
 * ignored, as it was in SQL. Undefined when it does not parse.
 */
function sqlName(name: string): string[] | undefined {
  const parts: string[] = [];
  let i = 0;
  const skipSpace = () => {
    while (i < name.length && SPACE.test(name[i])) i++;
  };

  for (;;) {
    skipSpace();
    if (name[i] === '"') {
      let part = '';
      for (i++; ; i++) {
        if (i >= name.length) return undefined;
        if (name[i] === '"') {
          if (name[i + 1] !== '"') break;
          i++;
        }
        part += name[i];
      }
      i++;
      if (part === '') return undefined;
      parts.push(part);
    } else {
      const match = PLAIN_PREFIX.exec(name.slice(i));
      if (!match) return undefined;
      parts.push(fold(match[0]));
      i += match[0].length;
    }

    skipSpace();
    if (i === name.length) return parts;
    if (name[i] !== '.') return undefined;
    i++;
  }
}

function dollarTag(body: string): string {
  let tag = '$notify$';
  for (let i = 1; body.includes(tag); i++) tag = `$notify${i}$`;
  return tag;
}

function script(statements: string[]): string {
  return statements.map((statement) => `${statement};\n`).join('\n');
}

function assertIdentifierLength(name: string) {
  const bytes = Buffer.byteLength(name, 'utf8');
  if (bytes > PG_MAX_IDENTIFIER_BYTES) {
    throw new Error(
      `Postgres identifier ${JSON.stringify(name)} is ${bytes} bytes; Postgres allows at most ${PG_MAX_IDENTIFIER_BYTES} and would silently truncate it`,
    );
  }
}

function assertSqlText(value: string, what: string) {
  if (typeof value !== 'string') {
    throw new TypeError(`A Postgres ${what} must be a string`);
  }
  if (value.includes('\0')) {
    throw new Error(`A Postgres ${what} cannot contain a NUL character`);
  }
}
