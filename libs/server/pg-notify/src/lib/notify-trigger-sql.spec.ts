import {
  CreateNotifyTriggerOptions,
  buildDropNotifyTriggerSql,
  buildNotifyTriggerSql,
  createNotifyTrigger,
  dropNotifyTrigger,
  quotePgIdentifier,
  quotePgLiteral,
  truncatePgIdentifier,
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
    expect(sql).toContain(`'id', notify_row."id", 'kind', notify_row."kind"`);
    expect(sql).toContain(
      `PERFORM pg_notify('outbox_events', json_build_object(`,
    );
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
      `pg_notify('c''); DROP TABLE users; --', json_build_object(`,
    );
    expect(sql).toContain(
      `'col"); DROP TABLE users; --', notify_row."col""); DROP TABLE users; --"`,
    );
    expect(sql).toContain(`'k''ey', notify_row."k'ey"`);
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

  it('picks OLD or NEW by TG_OP, whatever the events', () => {
    for (const events of [
      ['DELETE'],
      ['INSERT', 'DELETE'],
      ['INSERT', 'UPDATE', 'DELETE'],
    ] as CreateNotifyTriggerOptions['events'][]) {
      const sql = flat(buildNotifyTriggerSql({ ...outbox, events }));

      expect(sql).toContain(
        "IF TG_OP = 'DELETE' THEN notify_row := OLD; ELSE notify_row := NEW; END IF;",
      );
      expect(sql).toContain(`AFTER ${events!.join(' OR ')} ON "outbox"`);
      expect(sql).not.toMatch(/\b(NEW|OLD)\."/);
    }
  });

  it('rejects a channel pg_notify would reject', () => {
    expect(() => buildNotifyTriggerSql({ ...outbox, channel: '' })).toThrow(
      'cannot be empty',
    );
    expect(() =>
      buildNotifyTriggerSql({ ...outbox, channel: 'c'.repeat(64) }),
    ).toThrow('Postgres allows at most 63');
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

describe('function and trigger names', () => {
  const sqlFor = (options: Partial<CreateNotifyTriggerOptions>) =>
    flat(buildDropNotifyTriggerSql({ ...outbox, ...options }));

  // earlier versions emitted functionName unquoted, so postgres read
  // 'app.notify_outbox' as schema app, function notify_outbox
  it('splits a schema-qualified functionName', () => {
    expect(sqlFor({ functionName: 'app.notify_outbox' })).toContain(
      'DROP FUNCTION IF EXISTS "app"."notify_outbox"()',
    );
  });

  it("lets a qualified functionName's schema win over the table's", () => {
    expect(
      sqlFor({ table: 'data.outbox', functionName: 'fns.notify_outbox' }),
    ).toContain('DROP FUNCTION IF EXISTS "fns"."notify_outbox"()');
  });

  it("puts an unqualified functionName in the table's schema", () => {
    expect(
      sqlFor({ table: 'data.outbox', functionName: 'notify_outbox' }),
    ).toContain('DROP FUNCTION IF EXISTS "data"."notify_outbox"()');
  });

  it('folds plain parts and keeps double-quoted parts literally', () => {
    expect(sqlFor({ functionName: 'App."MyFn"' })).toContain(
      'DROP FUNCTION IF EXISTS "app"."MyFn"()',
    );
    expect(sqlFor({ functionName: '"MyFn"' })).toContain(
      'DROP FUNCTION IF EXISTS "MyFn"()',
    );
    expect(sqlFor({ functionName: '"a.b"' })).toContain(
      'DROP FUNCTION IF EXISTS "a.b"()',
    );
    expect(sqlFor({ functionName: '"say ""hi"""' })).toContain(
      'DROP FUNCTION IF EXISTS "say ""hi"""()',
    );
    expect(sqlFor({ triggerName: '"MyTrigger"' })).toContain(
      'DROP TRIGGER IF EXISTS "MyTrigger" ON',
    );
  });

  // postgres allows non-ASCII characters unquoted, and folds ASCII only
  it('treats non-ASCII characters as plain, folding only ASCII letters', () => {
    expect(sqlFor({ table: 'Tâble' })).toContain(
      'DROP FUNCTION IF EXISTS "notify_tâble_changed"()',
    );
    expect(sqlFor({ functionName: 'App.Fünf' })).toContain(
      'DROP FUNCTION IF EXISTS "app"."fünf"()',
    );
    expect(sqlFor({ functionName: 'ÉTAT' })).toContain(
      'DROP FUNCTION IF EXISTS "État"()',
    );
  });

  it('takes a name that does not parse as SQL literally, whole', () => {
    expect(sqlFor({ functionName: 'notify-outbox' })).toContain(
      'DROP FUNCTION IF EXISTS "notify-outbox"()',
    );
    expect(sqlFor({ functionName: '"unterminated' })).toContain(
      'DROP FUNCTION IF EXISTS """unterminated"()',
    );
  });

  it('rejects qualified trigger names and over-qualified function names', () => {
    expect(() => sqlFor({ triggerName: 'app.trg' })).toThrow(
      'cannot be schema-qualified',
    );
    expect(() => sqlFor({ functionName: 'db.app.fn' })).toThrow(
      'too many parts',
    );
  });

  // earlier versions let postgres cut long names; old migrations, re-run on a
  // fresh database or rolled back, must reach the same objects
  it('cuts long generated names to 63 bytes, as postgres did', () => {
    const table = 'a'.repeat(60);
    const sql = buildNotifyTriggerSql({ ...outbox, table });

    const fn = `notify_${table}_changed`.slice(0, 63);
    const trigger = `trg_notify_${table}_changed`.slice(0, 63);
    expect(sql).toContain(`FUNCTION "${fn}"()`);
    expect(sql).toContain(`CREATE TRIGGER "${trigger}"`);
    expect(sql).toContain(`ON "${table}"`);
    expect(buildDropNotifyTriggerSql({ ...outbox, table })).toContain(
      `DROP TRIGGER IF EXISTS "${trigger}" ON "${table}"`,
    );
  });

  it('cuts explicit names, tables, schemas and columns the same way', () => {
    const long = 'L'.repeat(70);
    const sql = buildNotifyTriggerSql({
      schema: `s${long}`,
      table: `t${long}`,
      channel: 'c',
      columns: [`c${long}`],
      functionName: `f${long}`,
      triggerName: `"T${long}"`,
    });
    const cut = (name: string) => name.slice(0, 63);

    expect(sql).toContain(`"${cut(`s${long}`)}"."${cut(`t${long}`)}"`);
    expect(sql).toContain(
      `"${cut(`s${long}`)}"."${cut(`f${long}`.toLowerCase())}"()`,
    );
    expect(sql).toContain(`CREATE TRIGGER "${cut(`T${long}`)}"`);
    // the JSON key is a string, not an identifier: it is sent whole
    expect(sql).toContain(`'c${long}', notify_row."${cut(`c${long}`)}"`);
  });

  // postgres cuts on a character boundary, so the result can be under 63
  it('never splits a multi-byte character', () => {
    // 'é' is 2 bytes: 'x' + 31 of them is 63 bytes, 'xx' + 31 would be 64
    expect(truncatePgIdentifier('x' + 'é'.repeat(40))).toBe(
      'x' + 'é'.repeat(31),
    );
    expect(truncatePgIdentifier('xx' + 'é'.repeat(40))).toBe(
      'xx' + 'é'.repeat(30),
    );
    // a 4-byte character straddling byte 63 is dropped whole
    expect(truncatePgIdentifier('x'.repeat(61) + '𝍧')).toBe('x'.repeat(61));
    expect(truncatePgIdentifier('x'.repeat(59) + '𝍧')).toBe(
      'x'.repeat(59) + '𝍧',
    );
    expect(truncatePgIdentifier('short')).toBe('short');
  });

  it('keeps quotePgIdentifier itself strict', () => {
    expect(() => quotePgIdentifier('x'.repeat(64))).toThrow(
      'is 64 bytes; Postgres allows at most 63',
    );
    expect(quotePgIdentifier('x'.repeat(63))).toBe(`"${'x'.repeat(63)}"`);
  });

  // earlier versions emitted these unquoted, and SQL ignores the whitespace
  it('ignores whitespace around function and trigger names and their dots', () => {
    expect(
      sqlFor({
        functionName: '  app . Notify_Outbox\n',
        triggerName: '\tTrg ',
      }),
    ).toBe(
      'DROP TRIGGER IF EXISTS "trg" ON "outbox"; DROP FUNCTION IF EXISTS "app"."notify_outbox"();',
    );
    expect(sqlFor({ functionName: ' "My Fn" ' })).toContain(
      'DROP FUNCTION IF EXISTS "My Fn"()',
    );
    // a name that still does not parse is taken literally, minus the padding
    expect(sqlFor({ functionName: ' notify-outbox ' })).toContain(
      'DROP FUNCTION IF EXISTS "notify-outbox"()',
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
