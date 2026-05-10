# @onivoro/server-typeorm-mysql

TypeORM MySQL integration for the Ivim monorepo: a NestJS dynamic module, an enhanced repository base class, and streaming support for large result sets.

Shared types and helpers (`IPagedData`, `IPageParams`, `manyToOneRelationOptions`, `removeFalseyKeys`, `getSkip`, `getPagingKey`) live in [`@onivoro/server-typeorm-common`](../typeorm-common/) and are re-exported from this package for convenience.

## Module setup

```typescript
import { ServerTypeormMysqlModule } from '@onivoro/server-typeorm-mysql';

@Module({
  imports: [
    ServerTypeormMysqlModule.configure(
      [UserRepository],           // injectables
      [User],                     // entities
      {
        host: 'localhost',
        port: '3306',
        username: 'root',
        password: 'password',
        database: 'myapp',
        synchronize: false,        // never true in production
        logging: false,
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

// Methods: getOne, getMany, getManyAndCount, postOne (save), postMany (save),
//          patch (update), put (save), delete, softDelete, head,
//          queryStream, forTransaction, buildWhereILike.
// `getOne` throws if the result set has more than one row.
```

### `TypeOrmPagingRepository<TEntity, TParams>`

Abstract subclass for paginated queries. Subclasses implement `getPage(pageParams, params)` and can use the inherited `getSkip`, `getPagingKey`, `removeFalseyKeys` helpers.

### Streaming

`queryStream({ query, onData, onError, onEnd })` emits rows through Node streams for large datasets without loading the full result set. Also available as a static on `TypeOrmRepository` when you want to pass a bespoke `QueryRunner`.

## License

MIT
