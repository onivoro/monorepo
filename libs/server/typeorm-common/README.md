# @onivoro/server-typeorm-common

Shared TypeORM helpers used by both [`@onivoro/server-typeorm-postgres`](../typeorm-postgres/) and [`@onivoro/server-typeorm-mysql`](../typeorm-mysql/). Both engine-specific libs re-export everything exported here, so consumers can import from whichever lib they already depend on — or from this package directly.

## Exports

### Types

- `IPagedData<TEntity>` — shape returned from paginated queries.
- `IPageParams` — page request shape.
- `IEntityProvider<TEntity, ...>` — the interface implemented by `TypeOrmRepository`.

### Functions

- `destroyDataSources(map)` — idempotently destroys every initialized `DataSource` in a `Map<string, DataSource>` and empties the map. Wired into both engine modules' `OnApplicationShutdown`.
- `getSkip(pagingKey, pageSize)` / `getPagingKey(pageSize, skip, total)` — pagination arithmetic.
- `removeFalseyKeys(obj)` — drops `undefined` entries from an object (note: keeps `null`, `''`, `0`, `false`).

### Constants

- `manyToOneRelationOptions` — `{ cascade: true, onDelete: 'CASCADE', orphanedRowAction: 'delete', onUpdate: 'CASCADE' }`.

## License

MIT
