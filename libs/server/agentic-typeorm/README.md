# @onivoro/server-agentic-typeorm

TypeORM persistence for
[`@onivoro/server-agentic`](https://www.npmjs.com/package/@onivoro/server-agentic):
entities, repositories implementing the contract's ports, and a migration
**factory** that adapts to your tenancy model rather than assuming one.

## Installation

```bash
npm install @onivoro/server-agentic-typeorm @onivoro/isomorphic-agentic typeorm
```

## Tables

| Table                            | Holds                                     |
| -------------------------------- | ----------------------------------------- |
| `agentic_conversations`          | title, status, participants, metadata     |
| `agentic_messages`               | role, status, parts (jsonb), usage        |
| `agentic_runs`                   | one turn: user + assistant message, usage |
| `agentic_conversation_summaries` | compaction records                        |
| `agentic_prompts`                | the per-owner prompt library              |

Names are fixed. The entities carry them in `@Entity()` and the repositories
reference those entities directly, so a rename would silently disagree with the
code that reads the rows. Everything _else_ about the schema is yours.

## The simple case

Re-export the shipped migrations and register the entities:

```ts
export { CreateAgenticChatTables1782300000100 } from '@onivoro/server-agentic-typeorm';
export { CreateAgenticPromptTables1782300000200 } from '@onivoro/server-agentic-typeorm';
```

No tenant scoping, this package's own keys and indexes.

## Adapting the schema

Anything beyond that — a tenant column, row-level security, composite keys —
means writing your own thin migration over the same factory:

```ts
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

## Repositories

`DefaultAgenticRepositories` bundles the five repositories into the
`AgenticRepositories` port the run loop expects:

```ts
{ provide: AGENTIC_REPOSITORIES, useExisting: DefaultAgenticRepositories }
```

Each repository takes an `EntityManager`, so a host that scopes work to a
transaction — as row-level security requires — constructs them inside it rather
than reaching for a globally-injected connection.

## License

MIT
