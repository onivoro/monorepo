# @onivoro/server-aws-redshift

AWS Redshift Data API integration for NestJS applications, aimed at **Redshift Serverless** workgroups.

## Installation

```bash
npm install @onivoro/server-aws-redshift @aws-sdk/client-redshift @aws-sdk/client-redshift-data @aws-sdk/client-redshift-serverless
```

`@nestjs/common` is also a peer dependency.

## Module Setup

```typescript
import { Module } from '@nestjs/common';
import { ServerAwsRedshiftDataModule } from '@onivoro/server-aws-redshift';

@Module({
  imports: [
    ServerAwsRedshiftDataModule.configure({
      AWS_REGION: process.env.AWS_REGION!,
      AWS_PROFILE: process.env.AWS_PROFILE, // optional
    }),
  ],
})
export class AppModule {}
```

## Configuration

```typescript
export class ServerAwsRedshiftDataConfig {
  AWS_PROFILE?: string;
  AWS_REGION: string;
}
```

Credentials come from [`@onivoro/server-aws-credential-providers`](../aws-credential-providers/): when `AWS_PROFILE` is set the named profile is used, otherwise the AWS SDK default credential chain applies.

The module provides and exports:

- `RedshiftDataService`
- `RedshiftDataClient` (`@aws-sdk/client-redshift-data`)
- `RedshiftServerlessClient` (`@aws-sdk/client-redshift-serverless`)
- `RedshiftClient` (`@aws-sdk/client-redshift`)
- `ServerAwsRedshiftDataConfig`

Each client is created once per process (the first `configure()` call wins) and is constructed with `logger: console`, so the SDK logs to the console.

## RedshiftDataService

Every method that runs SQL takes a target of `{ database: string; workgroupName: string }` and sends `ExecuteStatementCommand` with `WorkgroupName`, so these methods target Redshift Serverless (provisioned clusters via `ClusterIdentifier` are not supported).

```typescript
import { Injectable } from '@nestjs/common';
import { RedshiftDataService } from '@onivoro/server-aws-redshift';

const target = { database: 'analytics', workgroupName: 'analytics-wg' };

@Injectable()
export class ReportService {
  constructor(private readonly redshift: RedshiftDataService) {}

  async ordersSince(since: string) {
    // Named parameters use :name placeholders (Data API syntax)
    return this.redshift.query(target, 'SELECT id, total FROM sales.orders WHERE created_at >= :since', { since });
  }
}
```

### Queries

- **`query(target, sql, parameters?)`**: executes the statement, polls `DescribeStatement` every second until it is `FINISHED` (throws on `FAILED` or `ABORTED`), then fetches every page of `GetStatementResult` (following `NextToken`) and returns the rows as `Array<Array<string | number | boolean | undefined>>`. Each field is mapped to `stringValue ?? longValue ?? doubleValue ?? booleanValue`, so `0`, `false` and `''` are preserved; SQL `NULL` and `blobValue` fields come back as `undefined`. If fetching results fails (for example, the statement has no result set), it returns `[]`.
- **`queryV1(target, sql, parameters?)`**: executes the statement and waits with `waitForStatement`, returning the statement's `ResultRows` count (not the rows).
- **`waitForStatement(statementId, maxAttempts = 10, delay = 1000)`**: polls `DescribeStatement`; returns `ResultRows` on `FINISHED`; throws on `FAILED` or `ABORTED` (with the statement's `Error`, or `SQL statement was aborted`), or after `maxAttempts`.

`parameters` is either an `SqlParameter[]` passed through unchanged, or a `RedshiftQueryParameters` object (`Record<string, string | number | boolean | null | undefined>`) converted to `{ name, value: String(value) }` entries (`null`/`undefined` become an undefined value).

### User and Group Management

- **`createDbGroupFromIamGroupIfNotExists({ iamGroup, database, workgroupName })`**: creates the group with `CREATE GROUP` if `pg_group` has no group with that name.
- **`createDatabaseUser({ database, workgroupName, user })`**: looks the user up in `pg_user` by name (`usename`, bound as a parameter); if absent, runs `CREATE USER` with a random placeholder password (`IAM_<uuid>`) and returns that password, otherwise returns `''`. Errors are logged and rethrown.
- **`addIamUserToDatabaseGroup({ database, workgroupName, user, group })`**: runs `ALTER GROUP ... ADD USER`. Errors are logged with `console.warn` and not rethrown.
- **`grantUsageOnSchema({ database, workgroupName, schema, group })`**: grants `USAGE` on the schema, `SELECT` on all its tables, and default `SELECT` on future tables to the group. A failing statement is logged and the rest still run.
- **`getAssociatedIAmRolesByWorkgroup({ database, workgroupName })`**: lists every group in the target database with its members from `pg_group`/`pg_user` via `query`, one row per group/member: `[role_name, member_name, role_id, owner_id, is_member]` (`member_name` is `undefined` for a group with no members).

```typescript
await redshift.createDbGroupFromIamGroupIfNotExists({ ...target, iamGroup: 'analysts' });
await redshift.grantUsageOnSchema({ ...target, schema: 'reporting', group: 'analysts' });
await redshift.addIamUserToDatabaseGroup({ ...target, user: 'IAMR:analyst', group: 'analysts' });
```

Identifiers (user, group, schema names) are interpolated directly into SQL without quoting or escaping, so never pass untrusted input to these methods.

### Workgroups

- **`verifyEndpointAccess(workgroupName)`**: returns the `GetWorkgroupCommand` response, or `undefined` (after logging an error) if the workgroup has no endpoint address.

## Direct Client Access

For anything the service does not cover, inject the SDK clients directly:

```typescript
import { Injectable } from '@nestjs/common';
import { ListTablesCommand, RedshiftDataClient } from '@aws-sdk/client-redshift-data';

@Injectable()
export class CatalogService {
  constructor(private readonly dataClient: RedshiftDataClient) {}

  listTables(schemaPattern: string) {
    return this.dataClient.send(
      new ListTablesCommand({
        Database: 'analytics',
        WorkgroupName: 'analytics-wg',
        SchemaPattern: schemaPattern,
      }),
    );
  }
}
```

## Known Limitations

- `query` has no timeout; it polls until the statement is `FINISHED`, `FAILED` or `ABORTED`.

## License

MIT
