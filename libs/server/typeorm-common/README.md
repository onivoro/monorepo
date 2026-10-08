# @onivoro/server-typeorm-common

Shared TypeORM helpers used by both [`@onivoro/server-typeorm-postgres`](../typeorm-postgres/) and [`@onivoro/server-typeorm-mysql`](../typeorm-mysql/). Both engine-specific libs re-export everything exported here, so consumers can import from whichever lib they already depend on — or from this package directly.

## Installation

```bash
npm install @onivoro/server-typeorm-common typeorm
```

`typeorm` is a peer dependency.

## Exports

### Types

- `IPagedData<TEntity>` — shape returned from paginated queries: `{ data: TEntity[]; total: number; pagingKey: number; pageSize: number }`.
- `IPageParams` — page request shape: `{ pagingKey: number; pageSize: number; sortKey?: string; sortDirection?: string }`.
- `IEntityProvider<TEntity, TFindOneOptions, TFindManyOptions, TFindOptionsWhere, TQueryDeepPartialEntity>` — the interface implemented by `TypeOrmRepository` in both engine libs: `getOne`, `getMany`, `postOne`, `postMany`, `delete`, `put`, `patch`.

### Functions

- `destroyDataSources(map: Map<string, DataSource>): Promise<void>` — destroys every initialized `DataSource` in the map and removes each entry (even on failure; errors are logged with `console.error`, not thrown). Called from both engine modules' `onApplicationShutdown`.
- `getSkip(pagingKey: number | string, pageSize: number): number` — `Number(pagingKey) * pageSize`, or `0` when `pagingKey` is falsy. Paging keys are zero-based.
- `getPagingKey(pageSize, skip, total): number | undefined` — the next page's key (`skip / pageSize + 1`) when `skip + pageSize < total`, otherwise `undefined`.
- `removeFalseyKeys<T>(obj: T): T` — returns a copy without `undefined` entries (despite the name, keeps `null`, `''`, `0`, `false`).

```typescript
import { getPagingKey, getSkip, removeFalseyKeys } from '@onivoro/server-typeorm-common';

const pageSize = 25;
const skip = getSkip('2', pageSize); // 50
const next = getPagingKey(pageSize, skip, 120); // 3
const last = getPagingKey(pageSize, 100, 120); // undefined

removeFalseyKeys({ name: 'a', email: undefined, active: false }); // { name: 'a', active: false }
```

### Constants

- `manyToOneRelationOptions: RelationOptions` — `{ cascade: true, onDelete: 'CASCADE', orphanedRowAction: 'delete', onUpdate: 'CASCADE' }`.

```typescript
import { Entity, ManyToOne } from 'typeorm';
import { manyToOneRelationOptions } from '@onivoro/server-typeorm-common';

@Entity()
export class Comment {
  @ManyToOne(() => Post, (post) => post.comments, manyToOneRelationOptions)
  post: Post;
}
```

## License

MIT
