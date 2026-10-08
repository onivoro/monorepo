# @onivoro/server-typeorm-mysql

TypeORM MySQL integration for NestJS: a dynamic module, an enhanced repository base class, data source factories, and streaming support for large result sets.

Everything exported by [`@onivoro/server-typeorm-common`](../typeorm-common/) (`IPagedData`, `IPageParams`, `IEntityProvider`, `manyToOneRelationOptions`, `removeFalseyKeys`, `getSkip`, `getPagingKey`, `destroyDataSources`) is re-exported from this package.

## Installation

```bash
npm install @onivoro/server-typeorm-mysql typeorm typeorm-naming-strategies mysql @nestjs/typeorm
```

Peer dependencies: `@nestjs/common`, `@nestjs/typeorm`, `mysql`, `reflect-metadata`, `typeorm`, `typeorm-naming-strategies`.

## Module setup

```typescript
import { Module } from '@nestjs/common';
import { ServerTypeormMysqlModule } from '@onivoro/server-typeorm-mysql';

@Module({
  imports: [
    ServerTypeormMysqlModule.configure(
      [UserRepository], // injectables
      [User], // entities
      {
        host: 'localhost',
        port: '3306',
        username: 'root',
        password: 'password',
        database: 'myapp',
        synchronize: false, // forced to false when NODE_ENV === 'production'
        logging: false,
        // ca: fs.readFileSync('ca.pem', 'utf8'), // optional; enables ssl: { ca }
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

The data source uses `SnakeNamingStrategy`. `ServerTypeormMysqlModule` implements `OnApplicationShutdown` and calls `destroyDataSources` on the cached map (enable `app.enableShutdownHooks()` for this to run on signals).

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
  ca?: string; // when set, ssl: { ca }
}
```

## Data source factories

For use outside the Nest module (e.g. migrations CLI, scripts):

- `dataSourceConfigFactory(name, options, entities): MysqlConnectionOptions` — the config the module uses (`type: 'mysql'`, snake-case naming, empty `subscribers`/`migrations`).
- `dataSourceFactory(name, options, entities): DataSource` — `new DataSource(dataSourceConfigFactory(...))`, not initialized.
- `createMysqlDataSource({ name?, options, entities, migrations?, extras? }): DataSource` — same as above with `name` defaulting to `'default'`, optional `migrations` globs, and `extras` spread last over the config (overrides any key).

```typescript
// data-source.ts for the TypeORM CLI
import { createMysqlDataSource } from '@onivoro/server-typeorm-mysql';

export default createMysqlDataSource({
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
import { TypeOrmRepository } from '@onivoro/server-typeorm-mysql';

@Injectable()
export class UserRepository extends TypeOrmRepository<User> {
  constructor(entityManager: EntityManager) {
    super(User, entityManager);
  }
}

const active = await userRepository.getMany({ where: { active: true } });
const user = await userRepository.getOne({ where: { id } });
await userRepository.patch({ id }, { name: 'Ada' });
const exists = await userRepository.head({ email });
```

| Method                                  | Behavior                                                                                     |
| --------------------------------------- | -------------------------------------------------------------------------------------------- |
| `getMany(options: FindManyOptions)`     | `repo.find`                                                                                  |
| `getManyAndCount(options)`              | `repo.findAndCount` → `[rows, count]`                                                        |
| `getOne(options: FindOneOptions)`       | Runs `getMany` and throws if more than one row matches; resolves `undefined` when none match |
| `postOne(body)` / `postMany(body[])`    | `repo.save`                                                                                  |
| `put(entity \| entities, saveOptions?)` | `repo.save`, with TypeORM's save overloads                                                   |
| `patch(where, body)`                    | `repo.update`; resolves `void`                                                               |
| `delete(where)` / `softDelete(where)`   | `repo.delete` / `repo.softDelete`                                                            |
| `head(where, withDeleted = true)`       | `repo.exists`; soft-deleted rows count unless `withDeleted` is `false`                       |
| `buildWhereILike(filters?)`             | `{ col: ILike('%value%') }` for each truthy filter value; `{}` when `filters` is undefined   |
| `forTransaction(entityManager)`         | Returns a copy of this repository (same class) bound to `entityManager`                      |

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

### Streaming

```typescript
const { stream, error } = await userRepository.queryStream<{ id: number }>({
  query: 'SELECT id FROM user',
  onData: async (stream, record, count) => {
    /* ... */
  },
  onError: async (stream, err) => {
    /* ... */
  },
  onEnd: async (stream, count) => console.log(`${count} rows`),
});
```

`queryStream(params: TQueryStreamParams)` creates a `QueryRunner` from `entityManager.connection` and streams rows without loading the full result set. It resolves `{ stream, error: null }`, or `{ stream: null, error }` if the stream could not be opened; it throws `BadRequestException` when `query` is empty. The static `TypeOrmRepository.queryStream(queryRunner, params)` does the same with a `QueryRunner` you supply. The instance method releases the query runner it creates once the stream ends, errors or closes, or right away if the stream could not be opened. The static method never releases the query runner you pass in.

## License

MIT
