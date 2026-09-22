import type { QueryRunner } from 'typeorm';
import {
  agenticCreateTableSql,
  createAgenticChatTables,
  createAgenticPromptTables,
  dropAgenticChatTables,
} from './agentic-chat-tables.migration';

function fakeQueryRunner() {
  const queries: string[] = [];
  const runner = {
    query: async (sql: string) => {
      queries.push(sql.replace(/\s+/g, ' ').trim());
    },
  } as unknown as QueryRunner;
  return { runner, queries };
}

const matching = (queries: string[], pattern: RegExp) =>
  queries.filter((q) => pattern.test(q));

describe('agenticCreateTableSql', () => {
  it('emits the package columns and primary key', () => {
    const sql = agenticCreateTableSql('agentic_conversations');
    expect(sql).toContain('CREATE TABLE "agentic_conversations"');
    expect(sql).toContain('"status" text NOT NULL');
    expect(sql).toContain('CONSTRAINT "pk_agentic_conversations"');
  });

  it('appends additional columns before the primary key', () => {
    const sql = agenticCreateTableSql('agentic_conversations', {
      additionalColumns: {
        agentic_conversations: ['"tenant_id" uuid NOT NULL'],
      },
    });

    expect(sql).toContain('"tenant_id" uuid NOT NULL');
    expect(sql.indexOf('"tenant_id"')).toBeLessThan(
      sql.indexOf('CONSTRAINT "pk_agentic_conversations"'),
    );
  });

  it('leaves tables without additional columns untouched', () => {
    const sql = agenticCreateTableSql('agentic_messages', {
      additionalColumns: {
        agentic_conversations: ['"tenant_id" uuid NOT NULL'],
      },
    });
    expect(sql).not.toContain('tenant_id');
  });
});

describe('createAgenticChatTables', () => {
  it('creates every table in the set', async () => {
    const { runner, queries } = fakeQueryRunner();
    await createAgenticChatTables(runner);

    expect(matching(queries, /^CREATE TABLE/)).toHaveLength(4);
  });

  it('creates indexes and foreign keys by default', async () => {
    const { runner, queries } = fakeQueryRunner();
    await createAgenticChatTables(runner);

    expect(matching(queries, /^CREATE INDEX/).length).toBeGreaterThan(0);
    expect(matching(queries, /ADD CONSTRAINT "fk_/).length).toBe(3);
  });

  // a tenant-scoped schema supplies composite keys over (tenant_id, id)
  // instead, and the single-column ones would be wrong
  it('omits foreign keys and indexes when asked', async () => {
    const { runner, queries } = fakeQueryRunner();
    await createAgenticChatTables(runner, {
      createForeignKeys: false,
      createIndexes: false,
    });

    expect(matching(queries, /ADD CONSTRAINT "fk_/)).toHaveLength(0);
    expect(matching(queries, /^CREATE INDEX/)).toHaveLength(0);
    expect(matching(queries, /^CREATE TABLE/)).toHaveLength(4);
  });

  // RLS has to exist before anything inserts, so the hook runs against a table
  // that exists but is not yet referenced
  it('runs afterCreateTable immediately after each table', async () => {
    const { runner, queries } = fakeQueryRunner();
    await createAgenticChatTables(runner, {
      afterCreateTable: async (qr, table) => {
        await qr.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      },
    });

    const createIndex = queries.findIndex((q) => q.startsWith('CREATE TABLE'));
    expect(queries[createIndex + 1]).toContain('ENABLE ROW LEVEL SECURITY');
    expect(matching(queries, /ENABLE ROW LEVEL SECURITY/)).toHaveLength(4);
  });

  it('runs afterAll once, last', async () => {
    const { runner, queries } = fakeQueryRunner();
    await createAgenticChatTables(runner, {
      afterAll: async (qr) => {
        await qr.query('SELECT 1');
      },
    });

    expect(matching(queries, /^SELECT 1$/)).toHaveLength(1);
    expect(queries[queries.length - 1]).toBe('SELECT 1');
  });

  it('gives the hook the table it just created', async () => {
    const { runner } = fakeQueryRunner();
    const seen: string[] = [];
    await createAgenticChatTables(runner, {
      afterCreateTable: async (_qr, table) => {
        seen.push(table);
      },
    });

    expect(seen).toEqual([
      'agentic_conversations',
      'agentic_messages',
      'agentic_runs',
      'agentic_conversation_summaries',
    ]);
  });
});

describe('createAgenticPromptTables', () => {
  it('creates the prompt table and honours additional columns', async () => {
    const { runner, queries } = fakeQueryRunner();
    await createAgenticPromptTables(runner, {
      additionalColumns: { agentic_prompts: ['"tenant_id" uuid NOT NULL'] },
    });

    expect(matching(queries, /^CREATE TABLE "agentic_prompts"/)).toHaveLength(
      1,
    );
    expect(queries[0]).toContain('"tenant_id" uuid NOT NULL');
  });
});

describe('dropAgenticChatTables', () => {
  it('drops in reverse dependency order', async () => {
    const { runner, queries } = fakeQueryRunner();
    await dropAgenticChatTables(runner);

    const drops = matching(queries, /^DROP TABLE/);
    expect(drops[drops.length - 1]).toContain('agentic_conversations');
  });

  // dropping a constraint that was never created fails the migration
  it('does not drop keys or indexes it was told not to create', async () => {
    const { runner, queries } = fakeQueryRunner();
    await dropAgenticChatTables(runner, {
      createForeignKeys: false,
      createIndexes: false,
    });

    expect(matching(queries, /DROP CONSTRAINT/)).toHaveLength(0);
    expect(matching(queries, /^DROP INDEX/)).toHaveLength(0);
    expect(matching(queries, /^DROP TABLE/)).toHaveLength(4);
  });
});
