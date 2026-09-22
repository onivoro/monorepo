import type { QueryRunner } from 'typeorm';

/**
 * The tables this package owns.
 *
 * Names are fixed, not configurable. The entities carry them in `@Entity()`
 * decorators and the repositories reference those entities directly, so a
 * rename here would silently disagree with the code that reads the rows. A
 * consumer that genuinely needs different names has to supply its own entities,
 * and at that point it is not using this migration either.
 */
export type AgenticTable =
  | 'agentic_conversations'
  | 'agentic_messages'
  | 'agentic_runs'
  | 'agentic_conversation_summaries'
  | 'agentic_prompts';

export const AGENTIC_CHAT_TABLES: AgenticTable[] = [
  'agentic_conversations',
  'agentic_messages',
  'agentic_runs',
  'agentic_conversation_summaries',
];

export const AGENTIC_PROMPT_TABLES: AgenticTable[] = ['agentic_prompts'];

export interface CreateAgenticTablesOptions {
  /**
   * Extra column definitions appended to a table, as raw SQL fragments.
   *
   * This is where a multi-tenant schema adds its scoping column:
   * `{ agentic_conversations: ['"tenant_id" uuid NOT NULL'] }`.
   */
  additionalColumns?: Partial<Record<AgenticTable, string[]>>;

  /**
   * Create this package's foreign keys. Turn it off when supplying your own --
   * a tenant-scoped schema typically wants composite keys over
   * `(tenant_id, conversation_id)` rather than the single-column keys here.
   */
  createForeignKeys?: boolean;

  /**
   * Create this package's indexes. Turn it off to define your own; a
   * tenant-scoped schema usually wants the tenant column leading.
   */
  createIndexes?: boolean;

  /**
   * Runs after each table is created and before any keys or indexes.
   *
   * Row-level security belongs here: the policy has to exist before anything
   * inserts, and creating it alongside the table keeps the two from drifting.
   */
  afterCreateTable?: (
    queryRunner: QueryRunner,
    table: AgenticTable,
  ) => Promise<void>;

  /** Runs once, after every table, key and index in this set. */
  afterAll?: (queryRunner: QueryRunner) => Promise<void>;
}

const COLUMNS: Record<AgenticTable, string[]> = {
  agentic_conversations: [
    `"id" text NOT NULL`,
    `"title" text`,
    `"status" text NOT NULL`,
    `"participant_ids" jsonb`,
    `"latest_summary_message_id" text`,
    `"metadata" jsonb`,
    `"created_at" TIMESTAMPTZ NOT NULL`,
    `"updated_at" TIMESTAMPTZ NOT NULL`,
  ],
  agentic_messages: [
    `"id" text NOT NULL`,
    `"conversation_id" text NOT NULL`,
    `"role" text NOT NULL`,
    `"status" text NOT NULL`,
    `"parent_message_id" text`,
    `"run_id" text`,
    `"model" text`,
    `"provider" text`,
    `"parts" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    `"usage" jsonb`,
    `"compacted_at" TIMESTAMPTZ`,
    `"metadata" jsonb`,
    `"created_at" TIMESTAMPTZ NOT NULL`,
    `"updated_at" TIMESTAMPTZ NOT NULL`,
  ],
  agentic_runs: [
    `"id" text NOT NULL`,
    `"conversation_id" text NOT NULL`,
    `"status" text NOT NULL`,
    `"user_message_id" text`,
    `"assistant_message_id" text`,
    `"model" text`,
    `"provider" text`,
    `"usage" jsonb`,
    `"error_message" text`,
    `"metadata" jsonb`,
    `"started_at" TIMESTAMPTZ NOT NULL`,
    `"completed_at" TIMESTAMPTZ`,
    `"updated_at" TIMESTAMPTZ NOT NULL`,
  ],
  agentic_conversation_summaries: [
    `"id" text NOT NULL`,
    `"conversation_id" text NOT NULL`,
    `"summary_message_id" text NOT NULL`,
    `"start_message_id" text NOT NULL`,
    `"end_message_id" text NOT NULL`,
    `"token_count" integer`,
    `"created_at" TIMESTAMPTZ NOT NULL`,
    `"metadata" jsonb`,
  ],
  agentic_prompts: [
    `"id" text NOT NULL`,
    `"owner_participant_id" text NOT NULL`,
    `"title" text NOT NULL`,
    `"prompt" text NOT NULL`,
    `"parameters" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    `"metadata" jsonb`,
    `"created_at" TIMESTAMPTZ NOT NULL`,
    `"updated_at" TIMESTAMPTZ NOT NULL`,
  ],
};

const PRIMARY_KEYS: Record<AgenticTable, string> = {
  agentic_conversations: `CONSTRAINT "pk_agentic_conversations" PRIMARY KEY ("id")`,
  agentic_messages: `CONSTRAINT "pk_agentic_messages" PRIMARY KEY ("id")`,
  agentic_runs: `CONSTRAINT "pk_agentic_runs" PRIMARY KEY ("id")`,
  agentic_conversation_summaries: `CONSTRAINT "pk_agentic_conversation_summaries" PRIMARY KEY ("id")`,
  agentic_prompts: `CONSTRAINT "pk_agentic_prompts" PRIMARY KEY ("id")`,
};

const INDEXES: Partial<Record<AgenticTable, { name: string; sql: string }[]>> =
  {
    agentic_messages: [
      {
        name: 'idx_agentic_messages_conversation_created',
        sql: `CREATE INDEX "idx_agentic_messages_conversation_created" ON "agentic_messages" ("conversation_id", "created_at")`,
      },
      {
        name: 'idx_agentic_messages_run_id',
        sql: `CREATE INDEX "idx_agentic_messages_run_id" ON "agentic_messages" ("run_id")`,
      },
    ],
    agentic_runs: [
      {
        name: 'idx_agentic_runs_conversation_started',
        sql: `CREATE INDEX "idx_agentic_runs_conversation_started" ON "agentic_runs" ("conversation_id", "started_at")`,
      },
    ],
    agentic_conversation_summaries: [
      {
        name: 'idx_agentic_summaries_conversation_created',
        sql: `CREATE INDEX "idx_agentic_summaries_conversation_created" ON "agentic_conversation_summaries" ("conversation_id", "created_at")`,
      },
    ],
    agentic_prompts: [
      {
        name: 'idx_agentic_prompts_owner_updated',
        sql: `CREATE INDEX "idx_agentic_prompts_owner_updated" ON "agentic_prompts" ("owner_participant_id", "updated_at")`,
      },
    ],
  };

const FOREIGN_KEYS: Partial<
  Record<AgenticTable, { name: string; sql: string }[]>
> = {
  agentic_messages: [
    {
      name: 'fk_agentic_messages_conversation',
      sql: `ALTER TABLE "agentic_messages" ADD CONSTRAINT "fk_agentic_messages_conversation" FOREIGN KEY ("conversation_id") REFERENCES "agentic_conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    },
  ],
  agentic_runs: [
    {
      name: 'fk_agentic_runs_conversation',
      sql: `ALTER TABLE "agentic_runs" ADD CONSTRAINT "fk_agentic_runs_conversation" FOREIGN KEY ("conversation_id") REFERENCES "agentic_conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    },
  ],
  agentic_conversation_summaries: [
    {
      name: 'fk_agentic_summaries_conversation',
      sql: `ALTER TABLE "agentic_conversation_summaries" ADD CONSTRAINT "fk_agentic_summaries_conversation" FOREIGN KEY ("conversation_id") REFERENCES "agentic_conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    },
  ],
};

export function agenticCreateTableSql(
  table: AgenticTable,
  options: CreateAgenticTablesOptions = {},
): string {
  const body = [
    ...COLUMNS[table],
    ...(options.additionalColumns?.[table] ?? []),
    PRIMARY_KEYS[table],
  ].join(',\n      ');

  return `CREATE TABLE "${table}" (\n      ${body}\n    )`;
}

async function createTables(
  queryRunner: QueryRunner,
  tables: AgenticTable[],
  options: CreateAgenticTablesOptions,
): Promise<void> {
  for (const table of tables) {
    await queryRunner.query(agenticCreateTableSql(table, options));
    await options.afterCreateTable?.(queryRunner, table);
  }

  if (options.createIndexes ?? true) {
    for (const table of tables) {
      for (const index of INDEXES[table] ?? []) {
        await queryRunner.query(index.sql);
      }
    }
  }

  if (options.createForeignKeys ?? true) {
    for (const table of tables) {
      for (const key of FOREIGN_KEYS[table] ?? []) {
        await queryRunner.query(key.sql);
      }
    }
  }

  await options.afterAll?.(queryRunner);
}

async function dropTables(
  queryRunner: QueryRunner,
  tables: AgenticTable[],
  options: CreateAgenticTablesOptions,
): Promise<void> {
  const reversed = [...tables].reverse();

  if (options.createForeignKeys ?? true) {
    for (const table of reversed) {
      for (const key of FOREIGN_KEYS[table] ?? []) {
        await queryRunner.query(
          `ALTER TABLE "${table}" DROP CONSTRAINT "${key.name}"`,
        );
      }
    }
  }

  if (options.createIndexes ?? true) {
    for (const table of reversed) {
      for (const index of INDEXES[table] ?? []) {
        await queryRunner.query(`DROP INDEX "${index.name}"`);
      }
    }
  }

  for (const table of reversed) {
    await queryRunner.query(`DROP TABLE "${table}"`);
  }
}

export async function createAgenticChatTables(
  queryRunner: QueryRunner,
  options: CreateAgenticTablesOptions = {},
): Promise<void> {
  await createTables(queryRunner, AGENTIC_CHAT_TABLES, options);
}

export async function dropAgenticChatTables(
  queryRunner: QueryRunner,
  options: CreateAgenticTablesOptions = {},
): Promise<void> {
  await dropTables(queryRunner, AGENTIC_CHAT_TABLES, options);
}

export async function createAgenticPromptTables(
  queryRunner: QueryRunner,
  options: CreateAgenticTablesOptions = {},
): Promise<void> {
  await createTables(queryRunner, AGENTIC_PROMPT_TABLES, options);
}

export async function dropAgenticPromptTables(
  queryRunner: QueryRunner,
  options: CreateAgenticTablesOptions = {},
): Promise<void> {
  await dropTables(queryRunner, AGENTIC_PROMPT_TABLES, options);
}
