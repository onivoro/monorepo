# @onivoro/server-typeorm-postgres

A TypeORM PostgreSQL integration library providing repository patterns, SQL generation utilities, migration base classes, and PostgreSQL/Redshift-specific optimizations for enterprise-scale applications.

## Installation

```bash
npm install @onivoro/server-typeorm-postgres
```

## Features

- **TypeORM Repository Pattern**: Enhanced repository with PostgreSQL-specific features
- **Redshift Repository**: Specialized repository for Amazon Redshift operations
- **SQL Writer**: Static utility class for PostgreSQL DDL generation
- **Migration Base Classes**: Simplified migration classes for common operations
- **Custom Decorators**: Table and column decorators for entity definitions
- **Pagination Support**: Abstract paging repository for custom implementations
- **Type Safety**: Full TypeScript support with comprehensive type definitions

## Quick Start

### Module Import

```typescript
import { ServerTypeormPostgresModule } from '@onivoro/server-typeorm-postgres';

@Module({
  imports: [
    ServerTypeormPostgresModule
  ],
})
export class AppModule {}
```

### Entity Definition with Custom Decorators

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

  @TableColumn({ type: 'varchar', length: 255, unique: true })
  email: string;

  @TableColumn({ type: 'varchar', length: 100 })
  firstName: string;

  @NullableTableColumn({ type: 'timestamp' })
  lastLoginAt?: Date;

  @TableColumn({ type: 'boolean', default: true })
  isActive: boolean;

  @TableColumn({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;

  @TableColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @NullableTableColumn({ type: 'timestamp' })
  deletedAt?: Date;
}
```

## Repository Classes

### TypeOrmRepository

Enhanced repository with PostgreSQL-specific methods:

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

  // Core methods available:
  async findByEmail(email: string): Promise<User> {
    return this.getOne({ where: { email } });
  }

  async findActiveUsers(): Promise<User[]> {
    return this.getMany({ 
      where: { isActive: true } 
    });
  }

  async findUsersWithCount(): Promise<[User[], number]> {
    return this.getManyAndCount({ 
      where: { isActive: true } 
    });
  }

  async createUser(userData: Partial<User>): Promise<User> {
    return this.postOne(userData);
  }

  async createUsers(usersData: Partial<User>[]): Promise<User[]> {
    return this.postMany(usersData);
  }

  async updateUser(id: number, updates: Partial<User>): Promise<void> {
    // patch() uses TypeORM's update() method
    await this.patch({ id }, updates);
  }

  async replaceUser(id: number, userData: Partial<User>): Promise<void> {
    // put() uses TypeORM's save() method
    await this.put({ id }, userData);
  }

  async deleteUser(id: number): Promise<void> {
    await this.delete({ id });
  }

  async softDeleteUser(id: number): Promise<void> {
    await this.softDelete({ id });
  }

  // Transaction support
  async createUserInTransaction(userData: Partial<User>, entityManager: EntityManager): Promise<User> {
    const txRepository = this.forTransaction(entityManager);
    return txRepository.postOne(userData);
  }

  // Custom queries with mapping
  async findUsersByMetadata(key: string, value: any): Promise<User[]> {
    const query = `
      SELECT * FROM ${this.getTableNameExpression()}
      WHERE metadata->>'${key}' = $1
      AND deleted_at IS NULL
    `;
    return this.queryAndMap(query, [value]);
  }

  // Using ILike for case-insensitive search
  async searchUsers(searchTerm: string): Promise<User[]> {
    const filters = this.buildWhereILike({
      firstName: searchTerm,
      lastName: searchTerm,
      email: searchTerm
    });
    
    return this.getMany({ where: filters });
  }
}
```

### TypeOrmPagingRepository

Abstract base class for implementing pagination:

```typescript
import { Injectable } from '@nestjs/common';
import { TypeOrmPagingRepository, IPageParams, IPagedData } from '@onivoro/server-typeorm-postgres';
import { EntityManager, FindManyOptions } from 'typeorm';
import { User } from './user.entity';

// Define your custom params interface
interface UserPageParams {
  isActive?: boolean;
  search?: string;
  departmentId?: number;
}

@Injectable()
export class UserPagingRepository extends TypeOrmPagingRepository<User, UserPageParams> {
  constructor(entityManager: EntityManager) {
    super(User, entityManager);
  }

  // You must implement the abstract getPage method
  async getPage(pageParams: IPageParams, params: UserPageParams): Promise<IPagedData<User>> {
    const { page, limit } = pageParams;
    const skip = this.getSkip(page, limit);

    // Build where conditions
    const where = this.removeFalseyKeys({
      isActive: params.isActive,
      departmentId: params.departmentId
    });

    // Add search conditions if provided
    if (params.search) {
      Object.assign(where, this.buildWhereILike({
        firstName: params.search,
        lastName: params.search,
        email: params.search
      }));
    }

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

  // You can add additional helper methods
  getCacheKey(pageParams: IPageParams, params: UserPageParams): string {
    return this.getPagingKey(pageParams.page, pageParams.limit) + '_' + JSON.stringify(params);
  }
}
```

### RedshiftRepository

Specialized repository for Amazon Redshift with custom SQL building:

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

  // RedshiftRepository overrides several methods for Redshift compatibility
  async createAnalyticsEvent(event: Partial<AnalyticsEvent>): Promise<AnalyticsEvent> {
    // Uses custom SQL building and retrieval
    return this.postOne(event);
  }

  async bulkInsertEvents(events: Partial<AnalyticsEvent>[]): Promise<AnalyticsEvent[]> {
    // Uses optimized bulk insert
    return this.postMany(events);
  }

  // Performance-optimized methods unique to RedshiftRepository
  async insertWithoutReturn(event: Partial<AnalyticsEvent>): Promise<void> {
    // Inserts without performing retrieval query
    await this.postOneWithoutReturn(event);
  }

  async bulkInsertWithoutReturn(events: Partial<AnalyticsEvent>[]): Promise<void> {
    // NOTE: Currently throws NotImplementedException
    // await this.postManyWithoutReturn(events);
  }

  // Custom analytics queries
  async getEventAnalytics(startDate: Date, endDate: Date) {
    const query = `
      SELECT 
        event_type,
        COUNT(*) as event_count,
        COUNT(DISTINCT user_id) as unique_users,
        DATE_TRUNC('day', created_at) as event_date
      FROM ${this.getTableNameExpression()}
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY event_type, event_date
      ORDER BY event_date DESC, event_count DESC
    `;
    
    return this.query(query, [startDate, endDate]);
  }

  // Redshift handles JSONB differently
  async findEventsByJsonData(key: string, value: any): Promise<AnalyticsEvent[]> {
    // JSON_PARSE is used automatically for jsonb columns in Redshift
    const query = `
      SELECT * FROM ${this.getTableNameExpression()}
      WHERE JSON_EXTRACT_PATH_TEXT(event_data, '${key}') = $1
    `;
    
    return this.queryAndMap(query, [value]);
  }
}
```

## SQL Writer

Static utility class for generating PostgreSQL DDL:

```typescript
import { SqlWriter } from '@onivoro/server-typeorm-postgres';
import { TableColumnOptions } from 'typeorm';

// Add single column
const addColumnSql = SqlWriter.addColumn('users', {
  name: 'phone_number',
  type: 'varchar',
  length: 20,
  isNullable: true
});
// Returns: ALTER TABLE "users" ADD "phone_number" varchar(20)

// Create table with multiple columns
const createTableSql = SqlWriter.createTable('products', [
  { name: 'id', type: 'serial', isPrimary: true },
  { name: 'name', type: 'varchar', length: 255, isNullable: false },
  { name: 'price', type: 'decimal', precision: 10, scale: 2 },
  { name: 'metadata', type: 'jsonb', default: {} },
  { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' }
]);

// Drop table
const dropTableSql = SqlWriter.dropTable('products');
// Returns: DROP TABLE "products";

// Add multiple columns
const addColumnsSql = SqlWriter.addColumns('products', [
  { name: 'category_id', type: 'int', isNullable: true },
  { name: 'sku', type: 'varchar', length: 50, isUnique: true }
]);

// Drop column
const dropColumnSql = SqlWriter.dropColumn('products', { name: 'old_column' });
// Returns: ALTER TABLE "products" DROP COLUMN old_column

// Create indexes
const createIndexSql = SqlWriter.createIndex('products', 'name', false);
// Returns: CREATE INDEX IF NOT EXISTS products_name ON "products"(name)

const createUniqueIndexSql = SqlWriter.createUniqueIndex('products', 'sku');
// Returns: CREATE UNIQUE INDEX IF NOT EXISTS products_sku ON "products"(sku)

// Drop index
const dropIndexSql = SqlWriter.dropIndex('products_name');
// Returns: DROP INDEX IF EXISTS products_name

// Handle special default values
const jsonbColumn: TableColumnOptions = {
  name: 'settings',
  type: 'jsonb',
  default: { notifications: true, theme: 'light' }
};
const jsonbSql = SqlWriter.addColumn('users', jsonbColumn);
// Returns: ALTER TABLE "users" ADD "settings" jsonb DEFAULT '{"notifications":true,"theme":"light"}'::jsonb

// Boolean and numeric defaults
const booleanSql = SqlWriter.addColumn('users', {
  name: 'is_verified',
  type: 'boolean',
  default: false
});
// Returns: ALTER TABLE "users" ADD "is_verified" boolean DEFAULT FALSE
```

## Migration Base Classes

### TableMigrationBase

```typescript
import { TableMigrationBase } from '@onivoro/server-typeorm-postgres';
import { MigrationInterface } from 'typeorm';

export class CreateUsersTable1234567890 extends TableMigrationBase implements MigrationInterface {
  constructor() {
    super('users', [
      { name: 'id', type: 'serial', isPrimary: true },
      { name: 'email', type: 'varchar', length: 255, isUnique: true, isNullable: false },
      { name: 'first_name', type: 'varchar', length: 100, isNullable: false },
      { name: 'metadata', type: 'jsonb', default: '{}' },
      { name: 'is_active', type: 'boolean', default: true },
      { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      { name: 'deleted_at', type: 'timestamp', isNullable: true }
    ]);
  }
}
```

### ColumnMigrationBase

```typescript
import { ColumnMigrationBase } from '@onivoro/server-typeorm-postgres';

export class AddUserPhoneNumber1234567891 extends ColumnMigrationBase {
  constructor() {
    super('users', {
      name: 'phone_number',
      type: 'varchar',
      length: 20,
      isNullable: true
    });
  }
}
```

### ColumnsMigrationBase

```typescript
import { ColumnsMigrationBase } from '@onivoro/server-typeorm-postgres';

export class AddUserContactInfo1234567892 extends ColumnsMigrationBase {
  constructor() {
    super('users', [
      { name: 'phone_number', type: 'varchar', length: 20, isNullable: true },
      { name: 'secondary_email', type: 'varchar', length: 255, isNullable: true },
      { name: 'address', type: 'jsonb', isNullable: true }
    ]);
  }
}
```

### IndexMigrationBase

```typescript
import { IndexMigrationBase } from '@onivoro/server-typeorm-postgres';

export class CreateUserEmailIndex1234567893 extends IndexMigrationBase {
  constructor() {
    super('users', 'email', true); // table, column, unique
  }
}
```

### DropTableMigrationBase & DropColumnMigrationBase

```typescript
import { DropTableMigrationBase, DropColumnMigrationBase } from '@onivoro/server-typeorm-postgres';

export class DropLegacyUsersTable1234567894 extends DropTableMigrationBase {
  constructor() {
    super('legacy_users');
  }
}

export class DropUserMiddleName1234567895 extends DropColumnMigrationBase {
  constructor() {
    super('users', { name: 'middle_name' });
  }
}
```

## Building Repositories from Metadata

Both TypeOrmRepository and RedshiftRepository support building instances from metadata:

```typescript
import { TypeOrmRepository, RedshiftRepository } from '@onivoro/server-typeorm-postgres';
import { DataSource } from 'typeorm';

// Define your entity type
interface UserEvent {
  id: number;
  userId: number;
  eventType: string;
  eventData: any;
  createdAt: Date;
}

// Build TypeORM repository from metadata
const userEventRepo = TypeOrmRepository.buildFromMetadata<UserEvent>(dataSource, {
  schema: 'public',
  table: 'user_events',
  columns: {
    id: { 
      databasePath: 'id', 
      type: 'int', 
      propertyPath: 'id', 
      isPrimary: true,
      default: undefined 
    },
    userId: { 
      databasePath: 'user_id', 
      type: 'int', 
      propertyPath: 'userId', 
      isPrimary: false,
      default: undefined 
    },
    eventType: { 
      databasePath: 'event_type', 
      type: 'varchar', 
      propertyPath: 'eventType', 
      isPrimary: false,
      default: undefined 
    },
    eventData: { 
      databasePath: 'event_data', 
      type: 'jsonb', 
      propertyPath: 'eventData', 
      isPrimary: false,
      default: {} 
    },
    createdAt: { 
      databasePath: 'created_at', 
      type: 'timestamp', 
      propertyPath: 'createdAt', 
      isPrimary: false,
      default: 'CURRENT_TIMESTAMP' 
    }
  }
});

// Build Redshift repository from metadata
const analyticsRepo = RedshiftRepository.buildFromMetadata<UserEvent>(redshiftDataSource, {
  schema: 'analytics',
  table: 'user_events',
  columns: {
    // Same column definitions as above
  }
});

// Use the repositories
const events = await userEventRepo.getMany({ where: { userId: 123 } });
const recentEvent = await userEventRepo.getOne({ where: { id: 456 } });
```

## Data Source Configuration

```typescript
import { dataSourceFactory, dataSourceConfigFactory } from '@onivoro/server-typeorm-postgres';
import { User, Product, Order } from './entities';

// Using data source factory
const dataSource = dataSourceFactory('postgres-main', {
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'password',
  database: 'myapp'
}, [User, Product, Order]);

// Using config factory for more control
const config = dataSourceConfigFactory('postgres-main', {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
}, [User, Product, Order]);

const dataSource = new DataSource(config);
```

## Type Definitions

### Core Types

```typescript
// Table metadata
interface TTableMeta {
  databasePath: string;
  type: string;
  propertyPath: string;
  isPrimary: boolean;
  default?: any;
}

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
  ssl?: any;
  extra?: any;
}

// Entity provider interface
interface IEntityProvider<TEntity, TFindOneOptions, TFindManyOptions, TFindOptionsWhere, TUpdateData> {
  getOne(options: TFindOneOptions): Promise<TEntity>;
  getMany(options: TFindManyOptions): Promise<TEntity[]>;
  getManyAndCount(options: TFindManyOptions): Promise<[TEntity[], number]>;
  postOne(body: Partial<TEntity>): Promise<TEntity>;
  postMany(body: Partial<TEntity>[]): Promise<TEntity[]>;
  delete(options: TFindOptionsWhere): Promise<void>;
  softDelete(options: TFindOptionsWhere): Promise<void>;
  put(options: TFindOptionsWhere, body: TUpdateData): Promise<void>;
  patch(options: TFindOptionsWhere, body: TUpdateData): Promise<void>;
}
```

## Utility Functions

```typescript
import { 
  getSkip, 
  getPagingKey, 
  removeFalseyKeys,
  generateDateQuery,
  getApiTypeFromColumn 
} from '@onivoro/server-typeorm-postgres';

// Calculate skip value for pagination
const skip = getSkip(2, 20); // page 2, limit 20 = skip 20

// Generate cache key for pagination
const cacheKey = getPagingKey(2, 20); // Returns: "page_2_limit_20"

// Remove falsey values from object
const cleanedFilters = removeFalseyKeys({
  name: 'John',
  age: 0,        // Removed
  active: false, // Kept (false is not falsey for this function)
  email: '',     // Removed
  dept: null     // Removed
});

// Generate date range query
const dateQuery = generateDateQuery('created_at', {
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31')
});

// Get API type from TypeORM column metadata
const apiType = getApiTypeFromColumn(columnMetadata);
```

## Best Practices

1. **Repository Pattern**: Extend TypeOrmRepository for standard PostgreSQL operations
2. **Redshift Operations**: Use RedshiftRepository for analytics workloads with specific optimizations
3. **Pagination**: Implement TypeOrmPagingRepository for consistent pagination across your app
4. **Migrations**: Use migration base classes for consistent schema management
5. **SQL Generation**: Use SqlWriter for complex DDL operations
6. **Transactions**: Use `forTransaction()` to create transaction-scoped repositories
7. **Performance**: For Redshift bulk inserts, use `postOneWithoutReturn()` when you don't need the inserted record back
8. **Type Safety**: Leverage the strongly-typed column metadata for compile-time safety

## Testing

```typescript
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { UserRepository } from './user.repository';
import { User } from './user.entity';

describe('UserRepository', () => {
  let repository: UserRepository;
  let entityManager: EntityManager;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: 'localhost',
          port: 5432,
          username: 'test',
          password: 'test',
          database: 'test_db',
          entities: [User],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([User])
      ],
      providers: [UserRepository],
    }).compile();

    entityManager = module.get<EntityManager>(EntityManager);
    repository = new UserRepository(entityManager);
  });

  it('should create and retrieve user', async () => {
    const userData = {
      email: 'test@example.com',
      firstName: 'John',
      isActive: true
    };

    const user = await repository.postOne(userData);
    expect(user.id).toBeDefined();
    expect(user.email).toBe('test@example.com');

    const foundUser = await repository.getOne({ where: { id: user.id } });
    expect(foundUser).toEqual(user);
  });

  it('should handle transactions', async () => {
    await entityManager.transaction(async (transactionalEntityManager) => {
      const txRepository = repository.forTransaction(transactionalEntityManager);
      
      await txRepository.postOne({
        email: 'tx@example.com',
        firstName: 'Transaction',
        isActive: true
      });

      // Transaction will be rolled back after test
    });
  });
});
```

## License

This library is licensed under the MIT License. See the LICENSE file in this package for details.