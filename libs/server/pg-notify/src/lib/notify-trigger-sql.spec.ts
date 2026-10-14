import {
  CreateNotifyTriggerOptions,
  buildDropNotifyTriggerSql,
  buildNotifyTriggerSql,
  createNotifyTrigger,
  dropNotifyTrigger,
  quotePgIdentifier,
  quotePgLiteral,
} from './create-notify-trigger';

const outbox: CreateNotifyTriggerOptions = {
  table: 'outbox',
  channel: 'outbox_events',
  columns: ['id', 'kind'],
};

const flat = (sql: string) => sql.replace(/\s+/g, ' ').trim();

/**
 * The SQL with every quoted identifier and string literal removed, scanning
 * as postgres does (doubled quotes stay inside). Throws if a quote is left
 * open. Dollar-quoted bodies are scanned too, since their contents are
 * plpgsql that postgres parses the same way.
 */
function unquoted(sql: string): string {
  let out = '';
  for (let i = 0; i < sql.length; i++) {
    const quote = sql[i];
    if (quote !== '"' && quote !== "'") {
      out += quote;
      continue;
    }
    for (i++; ; i++) {
      if (i >= sql.length) throw new Error(`unterminated ${quote} in ${sql}`);
      if (sql[i] === quote) {
        if (sql[i + 1] === quote) i++;
        else break;
      }
    }
  }
  return out;
}

describe('quotePgIdentifier', () => {
  it('double-quotes, doubling embedded double quotes', () => {
    expect(quotePgIdentifier('outbox')).toBe('"outbox"');
    expect(quotePgIdentifier('Out"box')).toBe('"Out""box"');
    expect(quotePgIdentifier('x"; DROP TABLE users; --')).toBe(
      '"x""; DROP TABLE users; --"',
    );
  });

  it('rejects names postgres cannot hold', () => {
    expect(() => quotePgIdentifier('')).toThrow('empty');
    expect(() => quotePgIdentifier('a\0b')).toThrow('NUL');
  });
});

describe('quotePgLiteral', () => {
  it('single-quotes, doubling embedded single quotes', () => {
    expect(quotePgLiteral('events')).toBe("'events'");
    expect(quotePgLiteral("it's")).toBe("'it''s'");
    expect(quotePgLiteral("x'); DROP TABLE users; --")).toBe(
      "'x''); DROP TABLE users; --'",
    );
  });

  // reads the same whatever standard_conforming_strings is set to
  it('uses an E literal with doubled backslashes when there are any', () => {
    expect(quotePgLiteral("a\\'b")).toBe("E'a\\\\''b'");
  });

  it('rejects NUL', () => {
    expect(() => quotePgLiteral('a\0b')).toThrow('NUL');
  });
});

describe('buildNotifyTriggerSql', () => {
  it('needs no connection and matches what createNotifyTrigger runs', async () => {
    const run: string[] = [];
    await createNotifyTrigger({ query: async (sql) => run.push(sql) }, outbox);

    expect(buildNotifyTriggerSql(outbox)).toBe(
      run.map((sql) => `${sql};\n`).join('\n'),
    );
  });

  it('quotes the generated names and the table', () => {
    const sql = flat(buildNotifyTriggerSql(outbox));

    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION "notify_outbox_changed"() RETURNS TRIGGER',
    );
    expect(sql).toContain('CREATE TRIGGER "trg_notify_outbox_changed"');
    expect(sql).toContain('AFTER INSERT ON "outbox"');
    expect(sql).toContain('EXECUTE FUNCTION "notify_outbox_changed"();');
    expect(sql).toContain(`'id', NEW."id", 'kind', NEW."kind"`);
    expect(sql).toContain(`PERFORM pg_notify('outbox_events', payload::text)`);
  });

  // earlier versions emitted these names unquoted, so postgres folded them;
  // a down migration written then must still find what it created
  it('folds plain function and trigger names to lower case, as postgres did', () => {
    const sql = flat(
      buildNotifyTriggerSql({
        table: 'Outbox',
        channel: 'c',
        columns: ['id'],
        triggerName: 'Trg_Outbox',
      }),
    );

    expect(sql).toContain('FUNCTION "notify_outbox_changed"()');
    expect(sql).toContain('CREATE TRIGGER "trg_outbox"');
    // the table name was always quoted, so its case is kept
    expect(sql).toContain('ON "Outbox"');
  });

  it('qualifies table and function with a schema split from the table', () => {
    const sql = flat(buildNotifyTriggerSql({ ...outbox, table: 'app.outbox' }));

    expect(sql).toContain('FUNCTION "app"."notify_outbox_changed"()');
    expect(sql).toContain('ON "app"."outbox"');
    expect(sql).toContain('CREATE TRIGGER "trg_notify_outbox_changed"');
  });

  it('takes the table whole when the schema is given separately', () => {
    const sql = flat(
      buildNotifyTriggerSql({ ...outbox, schema: 'My Schema', table: 'a.b' }),
    );

    expect(sql).toContain('ON "My Schema"."a.b"');
    expect(sql).toContain('FUNCTION "My Schema"."notify_a.b_changed"()');
  });

  it('neutralises hostile table, column, channel and names', () => {
    const hostile = `x"; DROP TABLE users; --`;
    const sql = buildNotifyTriggerSql({
      table: hostile,
      schema: `s"`,
      channel: `c'); DROP TABLE users; --`,
      columns: [`col"); DROP TABLE users; --`, `k'ey`],
      functionName: `f"()`,
      triggerName: `t" ON users`,
    });

    expect(sql).toContain(`ON "s"""."x""; DROP TABLE users; --"`);
    expect(sql).toContain(`FUNCTION "s"""."f""()"()`);
    expect(sql).toContain(`CREATE TRIGGER "t"" ON users"`);
    expect(sql).toContain(
      `pg_notify('c''); DROP TABLE users; --', payload::text)`,
    );
    expect(sql).toContain(
      `'col"); DROP TABLE users; --', NEW."col""); DROP TABLE users; --"`,
    );
    expect(sql).toContain(`'k''ey', NEW."k'ey"`);
    // tokenised the way postgres reads it, the hostile text never escapes
    // its quotes: everything outside identifiers and literals is our own SQL
    expect(unquoted(sql)).not.toContain('DROP');
  });

  it('picks a dollar-quote tag that does not occur in the body', () => {
    const sql = buildNotifyTriggerSql({
      ...outbox,
      channel: 'a$notify$b',
      columns: ['$notify1$'],
    });

    expect(sql).toContain('AS $notify2$');
    expect(sql.trimEnd()).toMatch(/\$notify2\$;$/m);
    expect(sql.split('$notify2$')).toHaveLength(3);
  });

  it('reads OLD for a delete-only trigger', () => {
    const sql = flat(buildNotifyTriggerSql({ ...outbox, events: ['DELETE'] }));

    expect(sql).toContain('OLD."id"');
    expect(sql).toContain('RETURN OLD');
    expect(sql).toContain('AFTER DELETE ON');
  });

  it('rejects events that are not trigger events', () => {
    expect(() =>
      buildNotifyTriggerSql({
        ...outbox,
        events: ['INSERT; DROP TABLE users' as 'INSERT'],
      }),
    ).toThrow('Unsupported trigger event');
    expect(() => buildNotifyTriggerSql({ ...outbox, events: [] })).toThrow(
      'at least one event',
    );
  });
});

describe('buildDropNotifyTriggerSql', () => {
  it('drops the trigger then the function, quoted, and matches dropNotifyTrigger', async () => {
    const options = { ...outbox, table: 'app.outbox' };
    const run: string[] = [];
    await dropNotifyTrigger({ query: async (sql) => run.push(sql) }, options);

    const sql = buildDropNotifyTriggerSql(options);

    expect(sql).toBe(
      'DROP TRIGGER IF EXISTS "trg_notify_outbox_changed" ON "app"."outbox";\n' +
        '\n' +
        'DROP FUNCTION IF EXISTS "app"."notify_outbox_changed"();\n',
    );
    expect(sql).toBe(run.map((s) => `${s};\n`).join('\n'));
  });
});
