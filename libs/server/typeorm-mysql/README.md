# @onivoro/server-typeorm-mysql

A TypeORM MySQL integration library providing a NestJS module configuration, enhanced repository patterns, custom decorators, and utility functions for MySQL database operations.

## Installation

```bash
npm install @onivoro/server-typeorm-mysql
```

## Overview

This library provides:
- **NestJS Module**: Dynamic module configuration for TypeORM with MySQL
- **Enhanced Repository**: `TypeOrmRepository` with additional convenience methods
- **Paging Repository**: Abstract base class for implementing pagination
- **Custom Decorators**: Simplified table and column decorators with OpenAPI integration
- **Query Streaming**: Support for processing large datasets efficiently
- **Utility Functions**: Helper functions for pagination, date queries, and data manipulation

## Module Setup

```typescript
import { ServerTypeormMysqlModule } from '@onivoro/server-typeorm-mysql';
import { User, Product } from './entities';

@Module({
  imports: [
    ServerTypeormMysqlModule.configure(
      [UserRepository, ProductRepository], // Injectables
      [User, Product],                     // Entities
      {
        host: 'localhost',
        port: 3306,
        username: 'root',
        password: 'password',
        database: 'myapp',
        synchronize: false,                 // Never true in production
        logging: false
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
- Properly cleans up connections on application shutdown

## Entity Definition with Custom Decorators

The library provides simplified decorators that combine TypeORM and OpenAPI functionality:

```typescript
import { 
  Table, 
  PrimaryTableColumn, 
  TableColumn, 
  NullableTableColumn 
} from '@onivoro/server-typeorm-mysql';

@Table({ name: 'users' })
export class User {
  @PrimaryTableColumn()
  id: number;

  @TableColumn({ type: 'varchar' })
  email: string;

  @TableColumn({ type: 'varchar' })
  firstName: string;

  @NullableTableColumn({ type: 'datetime' })
  lastLoginAt?: Date;

  @TableColumn({ type: 'boolean' })
  isActive: boolean;
}
```

**Important**: These decorators only accept the `type` property from TypeORM's `ColumnOptions`. For full control over column options, use TypeORM's decorators directly.

## Repository Classes

### TypeOrmRepository

Enhanced repository with convenience methods and streaming support:

```typescript
import { Injectable } from '@nestjs/common';
import { TypeOrmRepository } from '@onivoro/server-typeorm-mysql';
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
    
    // postOne - save and return (uses save())
    const newUser = await this.postOne({ email: 'test@example.com', firstName: 'Test' });
    
    // postMany - bulk save and return (uses save())
    const newUsers = await this.postMany([
      { email: 'user1@example.com', firstName: 'User1' },
      { email: 'user2@example.com', firstName: 'User2' }
    ]);
    
    // patch - update using TypeORM's update()
    await this.patch({ id: 1 }, { isActive: false });
    
    // put - update using TypeORM's save()  
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

  // ILike helper for case-insensitive search
  async searchUsers(term: string) {
    const filters = this.buildWhereILike({
      firstName: term,
      email: term
    });
    return this.getMany({ where: filters });
  }
  
  // Query streaming for large datasets
  async exportUsers() {
    const { stream, error } = await this.queryStream({
      query: 'SELECT * FROM users WHERE isActive = 1',
      onData: async (stream, user, count) => {
        console.log(`Processing user ${count}: ${user.email}`);
      },
      onError: async (stream, error) => {
        console.error('Stream error:', error);
      },
      onEnd: async (stream, count) => {
        console.log(`Processed ${count} users`);
      }
    });
    
    if (error) {
      throw error;
    }
  }
}
```

The repository provides access to:
- `repo` - The underlying TypeORM repository
- `entityManager` - The EntityManager instance

### TypeOrmPagingRepository

Abstract base class requiring implementation of `getPage`:

```typescript
import { Injectable } from '@nestjs/common';
import { TypeOrmPagingRepository, IPageParams, IPagedData } from '@onivoro/server-typeorm-mysql';
import { EntityManager } from 'typeorm';
import { User } from './user.entity';

interface UserSearchParams {
  isActive?: boolean;
  departmentId?: number;
  search?: string;
}

@Injectable()
export class UserPagingRepository extends TypeOrmPagingRepository<User, UserSearchParams> {
  constructor(entityManager: EntityManager) {
    super(User, entityManager);
  }

  // Must implement this abstract method
  async getPage(pageParams: IPageParams, params: UserSearchParams): Promise<IPagedData<User>> {
    const { page, limit } = pageParams;
    const skip = this.getSkip(page, limit);

    const where = this.removeFalseyKeys({
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

Inherited helper methods:
- `getSkip(page, limit)` - Calculate skip value
- `getPagingKey(page, limit)` - Generate cache key
- `removeFalseyKeys(obj)` - Remove null/undefined/empty values

## Query Streaming

The library supports efficient processing of large datasets using Node.js streams:

```typescript
// Instance method on repository
const { stream, error } = await repository.queryStream({
  query: 'SELECT * FROM large_table',
  onData: async (stream, record, count) => {
    // Process each record
  },
  onError: async (stream, error) => {
    // Handle errors
  },
  onEnd: async (stream, totalCount) => {
    // Cleanup after processing
  }
});

// Static method with custom QueryRunner
const queryRunner = dataSource.createQueryRunner();
const { stream, error } = await TypeOrmRepository.queryStream(queryRunner, {
  query: 'SELECT * FROM another_table',
  // ... callbacks
});
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
} from '@onivoro/server-typeorm-mysql';

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
const dateFilter = generateDateQuery('created_at', 
  new Date('2024-01-01'), 
  new Date('2024-12-31')
);
// Returns TypeORM Between operator or MoreThanOrEqual/LessThanOrEqual

// Column type to API type mapping
const apiType = getApiTypeFromColumn('varchar'); // 'string'
const apiType2 = getApiTypeFromColumn('int'); // 'number'
const apiType3 = getApiTypeFromColumn('boolean'); // 'boolean'

// Create data source
const ds = dataSourceFactory('main', {
  host: 'localhost',
  port: 3306,
  username: 'user',
  password: 'pass',
  database: 'db'
}, [User, Product]);

// Create data source config
const config = dataSourceConfigFactory({
  host: 'localhost',
  port: 3306,
  username: 'user',
  password: 'pass',
  database: 'db',
  entities: [User, Product]
});
```

## Type Definitions

### Core Interfaces

```typescript
// Page parameters
interface IPageParams {
  page: number;
  limit: number;
}

// Paged data result
interface IPagedData<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Data source options
interface IDataSourceOptions {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  synchronize?: boolean;
  logging?: boolean;
  [key: string]: any;
}

// Query stream parameters
type TQueryStreamParams<TRecord = any> = {
  query: string;
  onData?: (stream: ReadStream, record: TRecord, count: number) => Promise<any | void>;
  onError?: (stream: ReadStream, error: any) => Promise<any | void>;
  onEnd?: (stream: ReadStream, count: number) => Promise<any | void>;
};
```

## Constants

```typescript
import { ManyToOneRelationOptions } from '@onivoro/server-typeorm-mysql';

// Predefined relation options for ManyToOne relationships
// { eager: false, cascade: false, nullable: false, onDelete: 'RESTRICT' }
@ManyToOne(() => User, user => user.orders, ManyToOneRelationOptions)
user: User;
```

## Important Implementation Details

1. **Module Caching**: Data sources are cached by name to prevent duplicate connections
2. **Repository Methods**:
   - `postOne` and `postMany` use TypeORM's `save()` method
   - `patch` uses TypeORM's `update()` 
   - `put` uses TypeORM's `save()`
   - `getOne` throws error if multiple results found
3. **Transaction Support**: The `forTransaction` method returns a shallow copy with new EntityManager
4. **Streaming**: Requires manual QueryRunner management for custom use cases
5. **Custom Decorators**: Only accept `type` property - use TypeORM decorators for full control

## Differences from typeorm-postgres

This MySQL library differs from the PostgreSQL version in several ways:
- No SQL writer utilities (DDL generation)
- No migration base classes
- No specialized Redshift repository
- No metadata-based repository building
- Simpler repository implementation using TypeORM's save() instead of custom SQL
- Built-in streaming support for large datasets

## License

MIT