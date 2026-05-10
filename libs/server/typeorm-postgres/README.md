# @onivoro/server-typeorm-postgres

TypeORM PostgreSQL integration for the Ivim monorepo: a NestJS dynamic module, enhanced repository base classes, and a Redshift repository.

Shared types and helpers (`IPagedData`, `IPageParams`, `manyToOneRelationOptions`, `removeFalseyKeys`, `getSkip`, `getPagingKey`) live in [`@onivoro/server-typeorm-common`](../typeorm-common/) and are re-exported from this package for convenience.

## Module setup

```typescript
import { ServerTypeormPostgresModule } from '@onivoro/server-typeorm-postgres';

@Module({
  imports: [
    ServerTypeormPostgresModule.configure(
      [UserRepository],           // injectables
      [User],                     // entities
      {
        host: 'localhost',
        port: '5432',
        username: 'postgres',
        password: 'password',
        database: 'myapp',
        ca: process.env.DB_CA,    // optional SSL CA
        synchronize: false,        // never true in production
        logging: false,
        schema: 'public',          // optional
      },
      'default',                  // connection name (default: 'default')
    ),
  ],
})
export class AppModule {}
```

The module caches data sources by name, uses `SnakeNamingStrategy`, and destroys open pools on application shutdown.

## Repositories

### `TypeOrmRepository<TEntity>`

Thin wrapper over TypeORM's `Repository` with convenience methods:

```typescript
@Injectable()
export class UserRepository extends TypeOrmRepository<User> {
  constructor(entityManager: EntityManager) {
    super(User, entityManager);
  }
}

// Methods: getOne, getMany, getManyAndCount, postOne (insert + returning),
//          postMany, patch (update), put (save), delete, softDelete, head,
//          query, queryAndMap, forTransaction, buildWhereILike.
// `getOne` throws if the result set has more than one row.
```

### `TypeOrmPagingRepository<TEntity, TParams>`

Abstract subclass for paginated queries. Subclasses implement `getPage(pageParams, params)` and can use the inherited `getSkip`, `getPagingKey`, `removeFalseyKeys` helpers.

### `RedshiftRepository<TEntity>`

Specialization of `TypeOrmRepository` for Amazon Redshift. Overrides `getMany`, `getOne`, `delete`, `patch`, `postOne`, `postMany` to emit raw SQL compatible with Redshift's quirks (e.g. `JSON_PARSE()` wrapping for `jsonb` columns). `put`, `forTransaction`, `getManyAndCount`, `postManyWithoutReturn`, and `head` throw `NotImplementedException` — Redshift can't meaningfully support them.

## License

MIT
