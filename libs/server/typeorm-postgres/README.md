# @onivoro/server-typeorm-postgres

TypeORM PostgreSQL integration for NestJS: a dynamic module, enhanced repository base classes, data source factories, and a Redshift repository.

Everything exported by [`@onivoro/server-typeorm-common`](../typeorm-common/) (`IPagedData`, `IPageParams`, `IEntityProvider`, `manyToOneRelationOptions`, `removeFalseyKeys`, `getSkip`, `getPagingKey`, `destroyDataSources`) is re-exported from this package.

## Installation

```bash
npm install @onivoro/server-typeorm-postgres typeorm typeorm-naming-strategies pg @nestjs/typeorm
```

Peer dependencies: `@nestjs/common`, `@nestjs/typeorm`, `pg`, `reflect-metadata`, `typeorm`, `typeorm-naming-strategies`. `@onivoro/isomorphic-common` and `@onivoro/server-typeorm-common` are installed as regular dependencies.

## Module setup

```typescript
import { Module } from '@nestjs/common';
import { ServerTypeormPostgresModule } from '@onivoro/server-typeorm-postgres';

@Module({
  imports: [
    ServerTypeormPostgresModule.configure(
      [UserRepository], // injectables
      [User], // entities
      {
        host: 'localhost',
        port: '5432',
        username: 'postgres',
        password: 'password',
        database: 'myapp',
        ca: process.env.DB_CA, // optional; when set, ssl: { ca }
        synchronize: false, // forced to false when NODE_ENV === 'production'
        logging: false,
        schema: 'public', // optional
      },
      'default', // connection name (default: 'default')
    ),
  ],
})
export class AppModule {}
```

`configure(injectables, entities, options: IDataSourceOptions, name = 'default')` provides and exports:

- `DataSource` — initialized on first use and cached by `name` in a module-level map, so a second `configure()` with the same name reuses the first data source (and its options/entities)
- `EntityManager` — `dataSource.manager`
- every class in `injectables`

The data source uses `SnakeNamingStrategy`. `ServerTypeormPostgresModule` implements `OnApplicationShutdown` and calls `destroyDataSources` on the cached map (enable `app.enableShutdownHooks()` for this to run on signals).

### `IDataSourceOptions`

```typescript
interface IDataSourceOptions {
  database: string;
  host: string;
  port: string;
  username: string;
  password: string;
  synchronize?: boolean; // default false
  logging?: boolean; // default false
  schema?: string;
  ca?: string; // when set, ssl: { ca }
}
```

## Data source factories

For use outside the Nest module (e.g. migrations CLI, scripts):

- `dataSourceConfigFactory(name, options, entities): PostgresConnectionOptions` — the config the module uses (`type: 'postgres'`, snake-case naming, empty `subscribers`/`migrations`). It logs a `console.info` line saying whether an SSL CA is in use, including `username@host:port/database`.
- `dataSourceFactory(name, options, entities): DataSource` — `new DataSource(dataSourceConfigFactory(...))`, not initialized.
- `createPostgresDataSource({ name?, options, entities, migrations?, extras? }): DataSource` — same as above with `name` defaulting to `'default'`, optional `migrations` globs, and `extras` spread last over the config (overrides any key).

```typescript
// data-source.ts for the TypeORM CLI
import { createPostgresDataSource } from '@onivoro/server-typeorm-postgres';

export default createPostgresDataSource({
  options: {
    host: process.env.DB_HOST!,
    port: process.env.DB_PORT!,
    username: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!,
  },
  entities: [User],
  migrations: ['dist/migrations/*.js'],
});
```

## Repositories

### `TypeOrmRepository<TEntity>`

Thin wrapper over TypeORM's `Repository` that implements `IEntityProvider`. Constructor: `(entityType: EntityTarget<TEntity>, entityManager: EntityManager)`; both are public properties, and `repo` returns `entityManager.getRepository(entityType)`.

```typescript
import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { TypeOrmRepository } from '@onivoro/server-typeorm-postgres';

@Injectable()
export class UserRepository extends TypeOrmRepository<User> {
  constructor(entityManager: EntityManager) {
    super(User, entityManager);
  }
}

const created = await userRepository.postOne({ email: 'ada@example.com' });
const user = await userRepository.getOne({ where: { id: created.id } });
await userRepository.patch({ id: user.id }, { name: 'Ada' });
```

| Method                                                  | Behavior                                                                                        |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `getMany(options: FindManyOptions)`                     | `repo.find`                                                                                     |
| `getManyAndCount(options)`                              | `repo.findAndCount` → `[rows, count]`                                                           |
| `getOne(options: FindOneOptions)`                       | Runs `getMany` and throws if more than one row matches; resolves `undefined` when none match    |
| `postOne(body)` / `postMany(body[])`                    | Query-builder `INSERT ... RETURNING *`; resolves the returned rows (no cascades, unlike `save`) |
| `put(entity \| entities, saveOptions?)`                 | `repo.save`, with TypeORM's save overloads                                                      |
| `patch(where, body)`                                    | `repo.update`; resolves `void`                                                                  |
| `delete(where)` / `softDelete(where)`                   | `repo.delete` / `repo.softDelete`                                                               |
| `head(where, withDeleted = true)`                       | `repo.exists`; soft-deleted rows count unless `withDeleted` is `false`                          |
| `getManyGroupedBy({ select, groupBy, where?, order? })` | Query-builder `SELECT ... GROUP BY`; resolves `getRawMany()`                                    |
| `query(sql, params)`                                    | `repo.query`; logs the query (and result) when `debug` is `true`                                |
| `queryAndMap(sql, params)`                              | `query` then `map` each row                                                                     |
| `map(raw)`                                              | Converts a raw row keyed by column names into an entity keyed by property names                 |
| `buildWhereILike(filters?)`                             | `{ col: ILike('%value%') }` for each truthy filter value; `{}` when `filters` is undefined      |
| `forTransaction(entityManager)`                         | Returns a copy of this repository (same class) bound to `entityManager`                         |

Metadata getters (read from `repo.metadata`, cached per entity class): `table`, `schema` (`''` when none), and `columns` — a record keyed by property name of `TTableMeta` (`{ databasePath, type, propertyPath, isPrimary, default }`).

```typescript
const users = await userRepository.queryAndMap(`SELECT * FROM "${userRepository.table}" WHERE ${userRepository.columns.email.databasePath} = $1`, ['ada@example.com']);

// select: { alias: SQL expression }; groupBy: entity property names
const counts = await userRepository.getManyGroupedBy<{ status: string; total: string }>({
  select: { status: 'status', total: 'COUNT(*)' },
  groupBy: ['status'],
});
```

`order`, when given, must list every key of the result type (`Record<keyof TReturn, 'ASC' | 'DESC'>`).

`forTransaction` does not call the constructor, so it works for any subclass constructor signature, including the one-argument `UserRepository` above. It creates an object with the same prototype, shallow-copies the instance's own properties, then sets `entityManager`; the original keeps its own `entityManager`. Properties a subclass adds are copied by reference.

### `TypeOrmPagingRepository<TEntity, TParams>`

Abstract subclass for paginated queries. Subclasses implement `getPage(pageParams: IPageParams, params: TParams): Promise<IPagedData<TEntity>>` and can use the inherited protected `getSkip`, `getPagingKey`, `removeFalseyKeys` helpers.

```typescript
@Injectable()
export class UserPagingRepository extends TypeOrmPagingRepository<User, { name?: string }> {
  constructor(entityManager: EntityManager) {
    super(User, entityManager);
  }

  async getPage({ pagingKey, pageSize }: IPageParams, params: { name?: string }): Promise<IPagedData<User>> {
    const skip = this.getSkip(pagingKey, pageSize);
    const [data, total] = await this.getManyAndCount({
      where: this.buildWhereILike(this.removeFalseyKeys(params)),
      skip,
      take: pageSize,
    });
    return { data, total, pageSize, pagingKey: this.getPagingKey(pageSize, skip, total)! };
  }
}
```

### `RedshiftRepository<TEntity>`

Specialization of `TypeOrmRepository` for Amazon Redshift that emits raw SQL instead of using TypeORM's query builder.

```typescript
import { In } from 'typeorm';
import { RedshiftRepository } from '@onivoro/server-typeorm-postgres';

// redshiftManager: the EntityManager of a DataSource connected to Redshift
const eventRepository = new RedshiftRepository<Event>(Event, redshiftManager);

await eventRepository.postOneWithoutReturn({ type: 'login', userId });
const events = await eventRepository.getMany({ where: { userId, type: In(['login', 'logout']) } });
```

- `getMany(options)` — `SELECT * FROM "schema"."table" WHERE ...` built from `options.where` only (other find options such as `order`, `take`, `relations` are ignored). Where values may be plain values, `null`, or the `In`, `Any`, `Equal`, `IsNull` operators; other operators throw.
- `getOne(options)` — `getMany` and throws if more than one row.
- `delete(where)` — `DELETE ... WHERE ...` (same where support as `getMany`).
- `patch(where, body)` — `UPDATE ... SET ... WHERE col = $n AND ...` (plain equality only).
- `softDelete(where)` — `patch(where, { deletedAt: new Date().toISOString() })`.
- `postOne(entity)` — inserts, then re-selects with `getOne({ where: entity })`.
- `postOneWithoutReturn(entity)` — inserts without re-selecting.
- `postMany(entities)` — one multi-row `INSERT`, then a `UNION` of selects to return the rows.
- Parameters bound to `jsonb` columns in inserts and `patch` are wrapped in `JSON_PARSE($n)`.
- `put`, `head`, `forTransaction`, `getManyAndCount`, and `postManyWithoutReturn` throw `NotImplementedException`.

## License

MIT
