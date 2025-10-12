# @onivoro/server-typeorm-postgres

A TypeORM PostgreSQL integration library providing a NestJS module configuration, enhanced repository patterns, SQL generation utilities, migration base classes, and custom decorators for PostgreSQL and Amazon Redshift applications.

## Installation

```bash
npm install @onivoro/server-typeorm-postgres typeorm-naming-strategies
```

## Overview

This library provides:
- **NestJS Module**: Dynamic module configuration for TypeORM with PostgreSQL
- **Enhanced Repositories**: `TypeOrmRepository` with additional methods beyond standard TypeORM
- **Redshift Repository**: Specialized repository for Amazon Redshift with optimizations
- **SQL Writer**: Static utility for generating PostgreSQL DDL statements  
- **Migration Base Classes**: Simplified classes for common migration operations
- **Custom Decorators**: Simplified table and column decorators with OpenAPI integration
- **Pagination Support**: Abstract base class for implementing paginated queries
- **Utility Functions**: Helper functions for pagination, date queries, and data manipulation

## Module Setup

```typescript
import { ServerTypeormPostgresModule } from '@onivoro/server-typeorm-postgres';
import { User, Product } from './entities';

@Module({
  imports: [
    ServerTypeormPostgresModule.configure(
      [UserRepository, ProductRepository], // Injectables
      [User, Product],                     // Entities
      {
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'password',
        database: 'myapp',
        ca: process.env.DB_CA,             // Optional SSL certificate
        synchronize: false,                 // Never true in production
        logging: false,
        schema: 'public'                   // Optional schema
      },
      'default'                            // Connection name
    )
  ]
})
export class AppModule {}
```

The module:
- Provides `DataSource` and `EntityManager` for injection
- Caches data sources by name to prevent duplicate connections
- Uses `SnakeNamingStrategy` for column naming
- Supports SSL connections with certificate

## Entity Definition with Custom Decorators

The library provides simplified decorators that combine TypeORM and OpenAPI functionality:

```typescript
import { 
  Table, 
  PrimaryTableColumn, 
  TableColumn, 
  NullableTableColumn 
} from '@onivoro/server-typeorm-postgres';

@Table({ name: 'users' })
export class User {
  @PrimaryTableColumn()
  id: number;

  @TableColumn({ type: 'varchar' })
  email: string;

  @TableColumn({ type: 'varchar' })
  firstName: string;

  @NullableTableColumn({ type: 'timestamp' })
  lastLoginAt?: Date;

  @TableColumn({ type: 'boolean' })
  isActive: boolean;

  @TableColumn({ type: 'jsonb' })
  metadata: Record<string, any>;
}
```

**Important**: These decorators only accept the `type` property from TypeORM's `ColumnOptions`. For full control over column options, use TypeORM's decorators directly.

## Repository Classes

### TypeOrmRepository

Enhanced repository with additional convenience methods:

```typescript
import { Injectable } from '@nestjs/common';
import { TypeOrmRepository } from '@onivoro/server-typeorm-postgres';
import { EntityManager } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UserRepository extends TypeOrmRepository<User> {
  constructor(entityManager: EntityManager) {
    super(User, entityManager);
  }

  // Available methods:
  async findUsers() {
    // getOne - throws if more than one result
    const user = await this.getOne({ where: { id: 1 } });
    
    // getMany - returns array
    const activeUsers = await this.getMany({ where: { isActive: true } });
    
    // getManyAndCount - returns [items, count]
    const [users, total] = await this.getManyAndCount({ 
      where: { isActive: true },
      take: 10,
      skip: 0 
    });
    
    // postOne - insert and return
    const newUser = await this.postOne({ email: 'test@example.com', firstName: 'Test' });
    
    // postMany - bulk insert and return
    const newUsers = await this.postMany([
      { email: 'user1@example.com', firstName: 'User1' },
      { email: 'user2@example.com', firstName: 'User2' }
    ]);
    
    // patch - update using TypeORM's update() (doesn't trigger hooks)
    await this.patch({ id: 1 }, { isActive: false });
    
    // put - update using TypeORM's save() (triggers hooks)  
    await this.put({ id: 1 }, { isActive: false });
    
    // delete - hard delete
    await this.delete({ id: 1 });
    
    // softDelete - soft delete
    await this.softDelete({ id: 1 });
  }

  // Transaction support
  async updateInTransaction(userId: number, data: Partial<User>, entityManager: EntityManager) {
    const txRepo = this.forTransaction(entityManager);
    await txRepo.patch({ id: userId }, data);
  }

  // Raw SQL with mapping
  async customQuery() {
    // query - returns raw results
    const raw = await this.query('SELECT * FROM users WHERE created_at > $1', [new Date('2024-01-01')]);
    
    // queryAndMap - maps results to entity type
    const users = await this.queryAndMap('SELECT * FROM users WHERE active = $1', [true]);
  }

  // ILike helper for case-insensitive search  
  async searchUsers(term: string) {
    const filters = this.buildWhereILike({
      firstName: term,
      email: term
    });
    return this.getMany({ where: filters });
  }
}
```

The repository also provides access to:
- `repo` - The underlying TypeORM repository
- `columns` - Metadata about entity columns
- `table` - Table name
- `schema` - Schema name

### TypeOrmPagingRepository

Abstract base class requiring implementation of `getPage`:

```typescript
import { Injectable } from '@nestjs/common';
import { TypeOrmPagingRepository, IPageParams, IPagedData, getSkip, getPagingKey, removeFalseyKeys } from '@onivoro/server-typeorm-postgres';
import { EntityManager } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UserPagingRepository extends TypeOrmPagingRepository<User, UserSearchParams> {
  constructor(entityManager: EntityManager) {
    super(User, entityManager);
  }

  // Must implement this abstract method
  async getPage(pageParams: IPageParams, params: UserSearchParams): Promise<IPagedData<User>> {
    const { page, limit } = pageParams;
    const skip = getSkip(page, limit);

    const where = removeFalseyKeys({
      departmentId: params.departmentId,
      isActive: params.isActive
    });

    const [data, total] = await this.getManyAndCount({
      where,
      skip,
      take: limit,
      order: { createdAt: 'DESC' }
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1
    };
  }
}
```

### RedshiftRepository  

Specialized repository for Amazon Redshift with different SQL generation:

```typescript
import { Injectable } from '@nestjs/common';
import { RedshiftRepository } from '@onivoro/server-typeorm-postgres';
import { EntityManager } from 'typeorm';
import { AnalyticsEvent } from './analytics-event.entity';

@Injectable()
export class AnalyticsRepository extends RedshiftRepository<AnalyticsEvent> {
  constructor(entityManager: EntityManager) {
    super(AnalyticsEvent, entityManager);
  }
  
  // Optimized methods for Redshift
  async bulkInsertEvents(events: Partial<AnalyticsEvent>[]) {
    // postOne - performs manual insert + select
    const event = await this.postOne({ type: 'click', userId: 123 });
    
    // postOneWithoutReturn - insert only, no select (better performance)
    await this.postOneWithoutReturn({ type: 'view', userId: 456 });
    
    // postMany - bulk insert with retrieval
    const inserted = await this.postMany(events);
    
    // postManyWithoutReturn - NOT IMPLEMENTED (throws error)
    // await this.postManyWithoutReturn(events);
  }
}
```

Key differences in RedshiftRepository:
- Uses raw SQL instead of TypeORM query builder for better Redshift compatibility
- Automatically wraps JSONB values with `JSON_PARSE()` 
- `getMany`, `getOne`, `delete`, `patch` use custom SQL generation
- `put`, `forTransaction`, `getManyAndCount` throw `NotImplementedException`
- `softDelete` uses patch with `deletedAt` field

## SQL Writer

Static utility class for generating PostgreSQL DDL:

```typescript
import { SqlWriter } from '@onivoro/server-typeorm-postgres';

// All methods return SQL strings
const sql1 = SqlWriter.addColumn('users', { name: 'phone', type: 'varchar', length: 20 });
// Returns: ALTER TABLE "users" ADD "phone" varchar(20)

const sql2 = SqlWriter.addColumns('users', [
  { name: 'phone', type: 'varchar', length: 20 },
  { name: 'address', type: 'jsonb', nullable: true }
]);

const sql3 = SqlWriter.createTable('products', [
  { name: 'id', type: 'serial', isPrimary: true },
  { name: 'name', type: 'varchar', length: 255 },
  { name: 'price', type: 'decimal', precision: 10, scale: 2 }
]);

const sql4 = SqlWriter.dropTable('old_table');
// Returns: DROP TABLE "old_table";

const sql5 = SqlWriter.dropColumn('users', { name: 'old_column' });  
// Returns: ALTER TABLE "users" DROP COLUMN old_column

const sql6 = SqlWriter.createIndex('users', 'email', false);
// Returns: CREATE INDEX IF NOT EXISTS users_email ON "users"(email)

const sql7 = SqlWriter.createUniqueIndex('users', 'username');
// Returns: CREATE UNIQUE INDEX IF NOT EXISTS users_username ON "users"(username)

const sql8 = SqlWriter.dropIndex('users_email');
// Returns: DROP INDEX IF EXISTS users_email
```

Special handling for defaults:
- JSONB values are stringified and cast: `'{"key":"value"}'::jsonb`
- Booleans become `TRUE`/`FALSE`
- Other values are quoted appropriately

## Migration Base Classes

Simplified migration classes that implement TypeORM's up/down methods:

```typescript
import { 
  TableMigrationBase,
  ColumnMigrationBase,
  ColumnsMigrationBase,
  IndexMigrationBase,
  DropTableMigrationBase,
  DropColumnMigrationBase 
} from '@onivoro/server-typeorm-postgres';

// Create table
export class CreateUsersTable1234567890 extends TableMigrationBase {
  constructor() {
    super('users', [
      { name: 'id', type: 'serial', isPrimary: true },
      { name: 'email', type: 'varchar', length: 255, isUnique: true }
    ]);
  }
}

// Add single column
export class AddUserPhone1234567891 extends ColumnMigrationBase {
  constructor() {
    super('users', { name: 'phone', type: 'varchar', length: 20, isNullable: true });
  }
}

// Add multiple columns
export class AddUserDetails1234567892 extends ColumnsMigrationBase {
  constructor() {
    super('users', [
      { name: 'phone', type: 'varchar', length: 20 },
      { name: 'address', type: 'jsonb' }
    ]);
  }
}

// Create index
export class IndexUserEmail1234567893 extends IndexMigrationBase {
  constructor() {
    super('users', 'email', true); // table, column, isUnique
  }
}

// Drop table
export class DropOldTable1234567894 extends DropTableMigrationBase {
  constructor() {
    super('legacy_users');
  }
}

// Drop column  
export class DropMiddleName1234567895 extends DropColumnMigrationBase {
  constructor() {
    super('users', { name: 'middle_name' });
  }
}
```

## Utility Functions

```typescript
import { 
  getSkip,
  getPagingKey,
  removeFalseyKeys,
  generateDateQuery,
  getApiTypeFromColumn,
  dataSourceFactory,
  dataSourceConfigFactory
} from '@onivoro/server-typeorm-postgres';

// Pagination helpers
const skip = getSkip(2, 20); // page 2, limit 20 = skip 20
const cacheKey = getPagingKey(2, 20); // "page_2_limit_20"

// Remove null/undefined/empty string values
const clean = removeFalseyKeys({ 
  name: 'John',
  age: null,      // removed
  email: '',      // removed  
  active: false   // kept
});

// Date range query builder
const dateFilter = generateDateQuery('created_at', {
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31')
});
// Returns TypeORM Between operator

// Column type to API type mapping
const apiType = getApiTypeFromColumn('varchar'); // 'string'
const apiType2 = getApiTypeFromColumn('int'); // 'number'
const apiType3 = getApiTypeFromColumn('jsonb'); // 'object'

// Create data source
const ds = dataSourceFactory('main', {
  host: 'localhost',
  port: 5432,
  username: 'user',
  password: 'pass',
  database: 'db'
}, [User, Product]);
```

## Building Repositories from Metadata

For dynamic entity handling without TypeORM decorators:

```typescript
const metadata = {
  schema: 'public',
  table: 'events',
  columns: {
    id: { databasePath: 'id', type: 'int', propertyPath: 'id', isPrimary: true, default: undefined },
    type: { databasePath: 'event_type', type: 'varchar', propertyPath: 'type', isPrimary: false, default: undefined },
    data: { databasePath: 'event_data', type: 'jsonb', propertyPath: 'data', isPrimary: false, default: {} }
  }
};

// Build TypeORM repository
const eventRepo = TypeOrmRepository.buildFromMetadata(dataSource, metadata);

// Build Redshift repository  
const analyticsRepo = RedshiftRepository.buildFromMetadata(redshiftDataSource, metadata);
```

## Important Implementation Details

1. **Data Source Caching**: The module caches data sources by name to prevent multiple connections
2. **Snake Case**: All database columns use snake_case via `SnakeNamingStrategy`
3. **Column Decorators**: The custom decorators are thin wrappers - use TypeORM decorators for full control
4. **Repository Methods**:
   - `patch` uses TypeORM's `update()` - doesn't trigger entity hooks
   - `put` uses TypeORM's `save()` - triggers entity hooks  
   - `getOne` throws error if multiple results found
5. **Redshift Limitations**:
   - No transaction support
   - No `getManyAndCount` 
   - `postManyWithoutReturn` not implemented
   - Automatic `JSON_PARSE()` wrapping for JSONB columns

## License

MIT