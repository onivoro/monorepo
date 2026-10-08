# @onivoro/server-agentic-typeorm

TypeORM persistence for
[`@onivoro/server-agentic`](https://www.npmjs.com/package/@onivoro/server-agentic):
entities, repositories implementing the contract's ports, and a migration
**factory** that adapts to your tenancy model rather than assuming one.

PostgreSQL only: the schema uses `jsonb` and `timestamptz`, and the queries use
`ILIKE` and jsonb containment.

## Installation

```bash
npm install @onivoro/server-agentic-typeorm @onivoro/isomorphic-agentic @nestjs/common typeorm
```

## Tables

| Table                            | Holds                                     | Entity                             |
| -------------------------------- | ----------------------------------------- | ---------------------------------- |
| `agentic_conversations`          | title, status, participants, metadata     | `AgenticConversationRecord`        |
| `agentic_messages`               | role, status, parts (jsonb), usage        | `AgenticMessageRecord`             |
| `agentic_runs`                   | one turn: user + assistant message, usage | `AgenticRunRecord`                 |
| `agentic_conversation_summaries` | compaction records                        | `AgenticConversationSummaryRecord` |
| `agentic_prompts`                | the per-owner prompt library              | `AgenticPromptRecord`              |

`agenticEntities` lists all five records for your DataSource or
`TypeOrmModule.forFeature`.

Names are fixed (`AgenticTable`). The entities carry them in `@Entity()` and the
repositories reference those entities directly, so a rename would silently
disagree with the code that reads the rows. Everything _else_ about the schema is
yours.

## The simple case

Re-export the shipped migrations and register the entities:

```ts
export { CreateAgenticChatTables1782300000100 } from '@onivoro/server-agentic-typeorm';
export { CreateAgenticPromptTables1782300000200 } from '@onivoro/server-agentic-typeorm';
```

The first creates the four chat tables, the second `agentic_prompts`. No tenant
scoping, this package's own keys and indexes.

## Adapting the schema

Anything beyond that — a tenant column, row-level security, composite keys —
means writing your own thin migration over the same factory:

```ts
import type { MigrationInterface, QueryRunner } from 'typeorm';
import { createAgenticChatTables, dropAgenticChatTables, type CreateAgenticTablesOptions } from '@onivoro/server-agentic-typeorm';

const TENANT: CreateAgenticTablesOptions = {
  additionalColumns: {
    agentic_conversations: ['"tenant_id" uuid NOT NULL'],
    agentic_messages: ['"tenant_id" uuid NOT NULL'],
    agentic_runs: ['"tenant_id" uuid NOT NULL'],
    agentic_conversation_summaries: ['"tenant_id" uuid NOT NULL'],
  },

  // Single-column keys over conversation_id would let one tenant's message
  // reference another tenant's conversation. Composite keys are added below.
  createForeignKeys: false,

  // The shipped indexes lead with conversation_id; under RLS you want the
  // tenant column leading.
  createIndexes: false,

  afterCreateTable: async (qr, table) => {
    await qr.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    await qr.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
    await qr.query(`
      CREATE POLICY "${table}_tenant_isolation" ON "${table}"
      USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
    `);
  },

  afterAll: async (qr) => {
    // your composite keys and tenant-leading indexes
  },
};

export class AddAgenticChat1787000000280 implements MigrationInterface {
  name = 'AddAgenticChat1787000000280';
  up = (qr: QueryRunner) => createAgenticChatTables(qr, TENANT);
  down = (qr: QueryRunner) => dropAgenticChatTables(qr, TENANT);
}
```

`createAgenticPromptTables` / `dropAgenticPromptTables` take the same options
for `agentic_prompts`. `agenticCreateTableSql(table, options?)` returns one
table's `CREATE TABLE` statement, and `AGENTIC_CHAT_TABLES` /
`AGENTIC_PROMPT_TABLES` list each set in creation order.

### Options

| Option              | Default | Effect                                                |
| ------------------- | ------- | ----------------------------------------------------- |
| `additionalColumns` | —       | Raw SQL column fragments appended per table           |
| `createForeignKeys` | `true`  | This package's single-column keys                     |
| `createIndexes`     | `true`  | This package's indexes                                |
| `afterCreateTable`  | —       | Runs per table, after CREATE, before keys and indexes |
| `afterAll`          | —       | Runs once, last                                       |

`afterCreateTable` fires before anything references the table, which is what
makes it the right place for row-level security: the policy exists before the
first insert can happen.

**Pass the same options to `down` as to `up`.** Dropping a constraint that was
never created fails the migration, so the drop path honours
`createForeignKeys` and `createIndexes` too.

## Adding columns to the entities

`additionalColumns` gets a column into the database; an entity that declares it
gets it into the ORM. Both halves are needed, because a column the ORM cannot
see is one it will not write on insert or read back on select.

Every entity ships as an abstract `…Columns` base plus a concrete `…Record`
that extends it and carries the `@Entity()`:

```ts
import { Column, Entity } from 'typeorm';
import { AgenticConversationColumns } from '@onivoro/server-agentic-typeorm';

@Entity('agentic_conversations')
export class TenantConversation extends AgenticConversationColumns {
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;
}
```

TypeORM treats an abstract base's columns as the subclass's own, so the result
is one entity with the full column set — not an inheritance hierarchy the
database has to know about.

**The shipped repositories do not use your subclass.** They read and write the
shipped `…Record` classes, which know nothing about `tenant_id`, so they will
not populate it and need those records registered. A schema with extra columns
needs its own repositories over its own entities (implementing the
`@onivoro/isomorphic-agentic` repository interfaces), or column defaults /
triggers that fill the extra columns without the ORM's help.

## Repositories

| Class                           | Implements                                                                                                                                                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AgenticConversationRepository` | `AgenticConversationRepository`; `list` filters by status (default `active`), participant, `resourceType` / `resourceId` metadata and a search over id, title and message text; limit defaults to 50, clamped to 1–100 |
| `AgenticMessageRepository`      | `AgenticMessageRepository`, plus `listNewestByConversationId` and `countByConversationId` (needed by `AgenticConversationLifecycleService`)                                                                            |
| `AgenticRunRepository`          | `AgenticRunRepository`                                                                                                                                                                                                 |
| `AgenticUsageRepository`        | `AgenticUsageRepository`; writes the `usage` column of a message or run                                                                                                                                                |
| `AgenticSummaryRepository`      | `AgenticSummaryRepository`                                                                                                                                                                                             |
| `AgenticPromptRepository`       | `AgenticPromptRepository`; owner-scoped, search over title and text, limit defaults to 100, clamped to 1–200                                                                                                           |

`DefaultAgenticRepositories` bundles all six into the `AgenticRepositories` port
the run loop expects, and `agenticRepositories` lists the seven classes as
providers. Each repository's only constructor argument is a TypeORM
`EntityManager`, so Nest can build them wherever one is injectable (for example
under `@nestjs/typeorm`):

```ts
import { AGENTIC_REPOSITORIES, AgenticChatModule } from '@onivoro/server-agentic';
import { agenticRepositories, DefaultAgenticRepositories } from '@onivoro/server-agentic-typeorm';

AgenticChatModule.configure({
  providers: [...agenticRepositories, { provide: AGENTIC_REPOSITORIES, useExisting: DefaultAgenticRepositories }],
});
```

A host that scopes work to a transaction — as row-level security requires —
constructs them inside it instead:

```ts
import { AgenticConversationRepository, AgenticMessageRepository, AgenticPromptRepository, AgenticRunRepository, AgenticSummaryRepository, AgenticUsageRepository, DefaultAgenticRepositories } from '@onivoro/server-agentic-typeorm';

await dataSource.transaction(async (manager) => {
  const repositories = new DefaultAgenticRepositories(new AgenticConversationRepository(manager), new AgenticMessageRepository(manager), new AgenticPromptRepository(manager), new AgenticRunRepository(manager), new AgenticUsageRepository(manager), new AgenticSummaryRepository(manager));
  // ...
});
```

## Mappers

The repositories convert between records and contract types with exported
functions: `toConversationRecord` / `fromConversationRecord`, `toMessageRecord` /
`fromMessageRecord`, `toRunRecord` / `fromRunRecord`, `toSummaryRecord` /
`fromSummaryRecord`, `toPromptRecord` / `fromPromptRecord`, plus `toDate` and
`toIso` for the ISO-string ↔ `Date` boundary. Reuse them in your own
repositories.

## License

MIT
