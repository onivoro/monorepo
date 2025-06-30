# @onivoro/server-typeorm-postgres

A comprehensive TypeORM PostgreSQL integration library for NestJS applications, providing custom repositories, migration utilities, decorators, and enhanced PostgreSQL-specific functionality for enterprise-scale database operations.

## Installation

```bash
npm install @onivoro/server-typeorm-postgres
```

## Features

- **TypeORM PostgreSQL Module**: Complete NestJS module for PostgreSQL integration
- **Custom Repository Classes**: Enhanced repository patterns with pagination and utilities
- **Migration Base Classes**: Structured migration classes for database schema management
- **Custom Decorators**: PostgreSQL-specific column decorators and table definitions
- **Redshift Support**: Amazon Redshift repository integration
- **SQL Writer Utilities**: Advanced SQL generation and execution utilities
- **Data Source Factory**: Flexible data source configuration and creation
- **Pagination Support**: Built-in pagination utilities and interfaces
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **PostgreSQL Optimizations**: PostgreSQL-specific optimizations and best practices

## Quick Start

### Import the Module

```typescript
import { ServerTypeormPostgresModule } from '@onivoro/server-typeorm-postgres';

@Module({
  imports: [
    ServerTypeormPostgresModule.forRoot({
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'password',
      database: 'myapp',
      entities: [User, Product, Order],
      synchronize: false,
      logging: true,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    })
  ],
})
export class AppModule {}
```

### Define Entities with Custom Decorators

```typescript
import { 
  Table, 
  PrimaryTableColumn, 
  TableColumn, 
  NullableTableColumn 
} from '@onivoro/server-typeorm-postgres';
import { Entity } from 'typeorm';

@Entity()
@Table('users')
export class User {
  @PrimaryTableColumn()
  id: number;

  @TableColumn({ type: 'varchar', length: 255, unique: true })
  email: string;

  @TableColumn({ type: 'varchar', length: 100 })
  firstName: string;

  @TableColumn({ type: 'varchar', length: 100 })
  lastName: string;

  @NullableTableColumn({ type: 'timestamp' })
  lastLoginAt?: Date;

  @TableColumn({ type: 'boolean', default: true })
  isActive: boolean;

  @TableColumn({ type: 'jsonb' })
  metadata: Record<string, any>;

  @TableColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @TableColumn({ 
    type: 'timestamp', 
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP'
  })
  updatedAt: Date;

  @NullableTableColumn({ type: 'timestamp' })
  deletedAt?: Date;
}
```

### Use Custom Repository

```typescript
import { Injectable } from '@nestjs/common';
import { TypeOrmRepository, TypeOrmPagingRepository } from '@onivoro/server-typeorm-postgres';
import { User } from './user.entity';

@Injectable()
export class UserRepository extends TypeOrmPagingRepository<User> {
  constructor() {
    super(User);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.findOne({ where: { email } });
  }

  async findActiveUsers(): Promise<User[]> {
    return this.find({ 
      where: { isActive: true, deletedAt: null } 
    });
  }

  async findUsersWithMetadata(key: string, value: any): Promise<User[]> {
    return this.createQueryBuilder('user')
      .where('user.metadata @> :metadata', { 
        metadata: JSON.stringify({ [key]: value }) 
      })
      .getMany();
  }

  async softDelete(id: number): Promise<void> {
    await this.update(id, { deletedAt: new Date() });
  }
}
```

## Configuration

### Data Source Configuration

```typescript
import { dataSourceConfigFactory } from '@onivoro/server-typeorm-postgres';

const config = dataSourceConfigFactory({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [User, Product, Order],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  extra: {
    max: 20, // Connection pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  }
});
```

### Dynamic Module Configuration

```typescript
import { Module } from '@nestjs/common';
import { ServerTypeormPostgresModule } from '@onivoro/server-typeorm-postgres';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ServerTypeormPostgresModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        host: configService.get('DATABASE_HOST'),
        port: configService.get('DATABASE_PORT'),
        username: configService.get('DATABASE_USERNAME'),
        password: configService.get('DATABASE_PASSWORD'),
        database: configService.get('DATABASE_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        synchronize: configService.get('NODE_ENV') === 'development',
        logging: configService.get('DATABASE_LOGGING') === 'true',
        ssl: configService.get('NODE_ENV') === 'production' ? {
          rejectUnauthorized: false
        } : false
      }),
      inject: [ConfigService]
    })
  ],
})
export class DatabaseModule {}
```

## Usage Examples

### Migration Base Classes

```typescript
import { 
  TableMigrationBase, 
  ColumnMigrationBase,
  IndexMigrationBase,
  DropTableMigrationBase 
} from '@onivoro/server-typeorm-postgres';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable1234567890 extends TableMigrationBase implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.createTable(queryRunner, 'users', [
      this.createColumn('id', 'SERIAL', { isPrimary: true }),
      this.createColumn('email', 'VARCHAR(255)', { isUnique: true, isNullable: false }),
      this.createColumn('first_name', 'VARCHAR(100)', { isNullable: false }),
      this.createColumn('last_name', 'VARCHAR(100)', { isNullable: false }),
      this.createColumn('metadata', 'JSONB', { default: "'{}'" }),
      this.createColumn('is_active', 'BOOLEAN', { default: true }),
      this.createColumn('created_at', 'TIMESTAMP', { default: 'CURRENT_TIMESTAMP' }),
      this.createColumn('updated_at', 'TIMESTAMP', { default: 'CURRENT_TIMESTAMP' }),
      this.createColumn('deleted_at', 'TIMESTAMP', { isNullable: true })
    ]);

    // Add indexes
    await this.createIndex(queryRunner, 'users', ['email']);
    await this.createIndex(queryRunner, 'users', ['is_active']);
    await this.createIndex(queryRunner, 'users', ['created_at']);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropTable(queryRunner, 'users');
  }
}

export class AddUserProfileColumns1234567891 extends ColumnMigrationBase implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.addColumn(queryRunner, 'users', 'phone_number', 'VARCHAR(20)', { isNullable: true });
    await this.addColumn(queryRunner, 'users', 'date_of_birth', 'DATE', { isNullable: true });
    await this.addColumn(queryRunner, 'users', 'avatar_url', 'TEXT', { isNullable: true });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropColumn(queryRunner, 'users', 'avatar_url');
    await this.dropColumn(queryRunner, 'users', 'date_of_birth');
    await this.dropColumn(queryRunner, 'users', 'phone_number');
  }
}
```

### Advanced Repository Usage

```typescript
import { Injectable } from '@nestjs/common';
import { TypeOrmPagingRepository, PageParams, PagedData } from '@onivoro/server-typeorm-postgres';
import { User } from './user.entity';
import { FindOptionsWhere, ILike, Raw, Between } from 'typeorm';

@Injectable()
export class AdvancedUserRepository extends TypeOrmPagingRepository<User> {
  constructor() {
    super(User);
  }

  async searchUsersWithFullText(
    searchTerm: string,
    pageParams: PageParams
  ): Promise<PagedData<User>> {
    // PostgreSQL full-text search
    return this.findWithPaging(
      {
        where: Raw(alias => `to_tsvector('english', ${alias}.first_name || ' ' || ${alias}.last_name || ' ' || ${alias}.email) @@ plainto_tsquery('english', :searchTerm)`, { searchTerm }),
        order: { createdAt: 'DESC' }
      },
      pageParams
    );
  }

  async findUsersByMetadataPath(
    jsonPath: string,
    value: any,
    pageParams: PageParams
  ): Promise<PagedData<User>> {
    return this.findWithPaging(
      {
        where: Raw(alias => `${alias}.metadata #>> :path = :value`, { 
          path: `{${jsonPath}}`,
          value: String(value)
        })
      },
      pageParams
    );
  }

  async findUsersWithArrayContains(
    metadataKey: string,
    containsValue: string
  ): Promise<User[]> {
    return this.createQueryBuilder('user')
      .where(`user.metadata->:key @> :value`, {
        key: metadataKey,
        value: JSON.stringify([containsValue])
      })
      .getMany();
  }

  async findUsersByDateRange(
    startDate: Date,
    endDate: Date,
    pageParams: PageParams
  ): Promise<PagedData<User>> {
    return this.findWithPaging(
      {
        where: {
          createdAt: Between(startDate, endDate),
          deletedAt: null
        },
        order: { createdAt: 'DESC' }
      },
      pageParams
    );
  }

  async getUserAggregateStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    avgMetadataSize: number;
    recentRegistrations: number;
  }> {
    const result = await this.createQueryBuilder('user')
      .select([
        'COUNT(*) as total',
        'COUNT(CASE WHEN user.isActive = true THEN 1 END) as active',
        'COUNT(CASE WHEN user.isActive = false THEN 1 END) as inactive',
        'AVG(jsonb_array_length(user.metadata)) as avgMetadataSize',
        `COUNT(CASE WHEN user.createdAt >= :weekAgo THEN 1 END) as recentRegistrations`
      ])
      .where('user.deletedAt IS NULL')
      .setParameter('weekAgo', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      .getRawOne();

    return {
      total: parseInt(result.total),
      active: parseInt(result.active),
      inactive: parseInt(result.inactive),
      avgMetadataSize: parseFloat(result.avgmetadatasize) || 0,
      recentRegistrations: parseInt(result.recentregistrations)
    };
  }
}
```

### Redshift Integration

```typescript
import { Injectable } from '@nestjs/common';
import { RedshiftRepository } from '@onivoro/server-typeorm-postgres';

@Injectable()
export class AnalyticsRepository extends RedshiftRepository {
  constructor() {
    super();
  }

  async getUserActivitySummary(startDate: Date, endDate: Date) {
    return this.query(`
      SELECT 
        u.id,
        u.email,
        COUNT(a.id) as activity_count,
        MAX(a.created_at) as last_activity,
        AVG(a.duration) as avg_duration
      FROM users u
      LEFT JOIN user_activities a ON u.id = a.user_id
      WHERE a.created_at BETWEEN $1 AND $2
      GROUP BY u.id, u.email
      ORDER BY activity_count DESC
      LIMIT 100
    `, [startDate, endDate]);
  }

  async getMonthlyUserGrowth() {
    return this.query(`
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as new_users,
        SUM(COUNT(*)) OVER (ORDER BY DATE_TRUNC('month', created_at)) as cumulative_users
      FROM users
      WHERE deleted_at IS NULL
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month
    `);
  }

  async getUserSegmentAnalysis() {
    return this.query(`
      WITH user_segments AS (
        SELECT 
          u.id,
          u.metadata->>'segment' as segment,
          COUNT(o.id) as order_count,
          SUM(o.total_amount) as total_spent
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id
        WHERE u.deleted_at IS NULL
        GROUP BY u.id, u.metadata->>'segment'
      )
      SELECT 
        segment,
        COUNT(*) as user_count,
        AVG(order_count) as avg_orders_per_user,
        AVG(total_spent) as avg_spend_per_user,
        SUM(total_spent) as total_segment_revenue
      FROM user_segments
      GROUP BY segment
      ORDER BY total_segment_revenue DESC
    `);
  }
}
```

### SQL Writer Utilities

```typescript
import { Injectable } from '@nestjs/common';
import { SqlWriter } from '@onivoro/server-typeorm-postgres';
import { DataSource } from 'typeorm';

@Injectable()
export class ReportingService {
  private sqlWriter: SqlWriter;

  constructor(private dataSource: DataSource) {
    this.sqlWriter = new SqlWriter(dataSource);
  }

  async generateUserReport(filters: {
    startDate?: Date;
    endDate?: Date;
    segment?: string;
    isActive?: boolean;
  }) {
    const query = this.sqlWriter
      .select([
        'u.id',
        'u.email',
        'u.first_name',
        'u.last_name',
        'u.metadata',
        'u.created_at',
        'COUNT(o.id) as order_count',
        'SUM(o.total_amount) as total_spent'
      ])
      .from('users', 'u')
      .leftJoin('orders', 'o', 'u.id = o.user_id')
      .where('u.deleted_at IS NULL');

    if (filters.startDate) {
      query.andWhere('u.created_at >= :startDate', { startDate: filters.startDate });
    }

    if (filters.endDate) {
      query.andWhere('u.created_at <= :endDate', { endDate: filters.endDate });
    }

    if (filters.segment) {
      query.andWhere("u.metadata->>'segment' = :segment", { segment: filters.segment });
    }

    if (filters.isActive !== undefined) {
      query.andWhere('u.is_active = :isActive', { isActive: filters.isActive });
    }

    return query
      .groupBy(['u.id', 'u.email', 'u.first_name', 'u.last_name', 'u.metadata', 'u.created_at'])
      .orderBy('u.created_at', 'DESC')
      .execute();
  }

  async generateDashboardMetrics() {
    const queries = {
      totalUsers: this.sqlWriter
        .select('COUNT(*)')
        .from('users')
        .where('deleted_at IS NULL'),

      activeUsers: this.sqlWriter
        .select('COUNT(*)')
        .from('users')
        .where('deleted_at IS NULL')
        .andWhere('is_active = true'),

      newUsersThisMonth: this.sqlWriter
        .select('COUNT(*)')
        .from('users')
        .where('deleted_at IS NULL')
        .andWhere("created_at >= DATE_TRUNC('month', CURRENT_DATE)"),

      totalOrders: this.sqlWriter
        .select('COUNT(*)')
        .from('orders'),

      totalRevenue: this.sqlWriter
        .select('SUM(total_amount)')
        .from('orders')
        .where("status != 'cancelled'")
    };

    const results = await Promise.all(
      Object.entries(queries).map(async ([key, query]) => [
        key,
        await query.getRawOne()
      ])
    );

    return Object.fromEntries(results);
  }
}
```

### Complex Entity Relationships

```typescript
import { 
  Table, 
  PrimaryTableColumn, 
  TableColumn, 
  NullableTableColumn,
  ManyToOneRelationOptions 
} from '@onivoro/server-typeorm-postgres';
import { Entity, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';

@Entity()
@Table('orders')
@Index(['userId', 'status'])
@Index(['createdAt'])
export class Order {
  @PrimaryTableColumn()
  id: number;

  @TableColumn({ type: 'varchar', length: 50, unique: true })
  orderNumber: string;

  @TableColumn({ type: 'decimal', precision: 12, scale: 2 })
  totalAmount: number;

  @TableColumn({ 
    type: 'enum', 
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'] 
  })
  status: string;

  @TableColumn({ type: 'int' })
  userId: number;

  @TableColumn({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;

  @TableColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @NullableTableColumn({ type: 'timestamp' })
  shippedAt?: Date;

  @NullableTableColumn({ type: 'timestamp' })
  deliveredAt?: Date;

  @NullableTableColumn({ type: 'timestamp' })
  cancelledAt?: Date;

  // Full-text search column
  @TableColumn({ type: 'tsvector', select: false })
  searchVector: string;

  // Relationships
  @ManyToOne(() => User, user => user.orders, ManyToOneRelationOptions)
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => OrderItem, orderItem => orderItem.order, { cascade: true })
  items: OrderItem[];
}

@Entity()
@Table('order_items')
@Index(['orderId', 'productId'])
export class OrderItem {
  @PrimaryTableColumn()
  id: number;

  @TableColumn({ type: 'int' })
  orderId: number;

  @TableColumn({ type: 'int' })
  productId: number;

  @TableColumn({ type: 'int' })
  quantity: number;

  @TableColumn({ type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  @TableColumn({ type: 'decimal', precision: 10, scale: 2 })
  totalPrice: number;

  @TableColumn({ type: 'jsonb', default: '{}' })
  productSnapshot: Record<string, any>;

  @ManyToOne(() => Order, order => order.items, ManyToOneRelationOptions)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @ManyToOne(() => Product, product => product.orderItems, ManyToOneRelationOptions)
  @JoinColumn({ name: 'productId' })
  product: Product;
}
```

### Advanced PostgreSQL Features

```typescript
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class PostgresAdvancedService {
  constructor(private dataSource: DataSource) {}

  async createFullTextSearchIndex(tableName: string, columns: string[]): Promise<void> {
    const vectorColumn = `${tableName}_search_vector`;
    const indexName = `idx_${tableName}_fulltext`;
    
    // Add tsvector column if it doesn't exist
    await this.dataSource.query(`
      ALTER TABLE ${tableName} 
      ADD COLUMN IF NOT EXISTS ${vectorColumn} tsvector
    `);

    // Create trigger to update search vector
    await this.dataSource.query(`
      CREATE OR REPLACE FUNCTION update_${tableName}_search_vector() 
      RETURNS trigger AS $$
      BEGIN
        NEW.${vectorColumn} := to_tsvector('english', ${columns.map(col => `COALESCE(NEW.${col}, '')`).join(" || ' ' || ")});
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create trigger
    await this.dataSource.query(`
      DROP TRIGGER IF EXISTS trigger_${tableName}_search_vector ON ${tableName};
      CREATE TRIGGER trigger_${tableName}_search_vector
      BEFORE INSERT OR UPDATE ON ${tableName}
      FOR EACH ROW EXECUTE FUNCTION update_${tableName}_search_vector();
    `);

    // Create GIN index
    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS ${indexName} 
      ON ${tableName} USING gin(${vectorColumn})
    `);

    // Update existing records
    await this.dataSource.query(`
      UPDATE ${tableName} 
      SET ${vectorColumn} = to_tsvector('english', ${columns.map(col => `COALESCE(${col}, '')`).join(" || ' ' || ")})
    `);
  }

  async performFullTextSearch(
    tableName: string,
    searchTerm: string,
    limit: number = 10
  ): Promise<any[]> {
    const vectorColumn = `${tableName}_search_vector`;
    
    return this.dataSource.query(`
      SELECT *, 
             ts_rank(${vectorColumn}, plainto_tsquery('english', $1)) as rank
      FROM ${tableName}
      WHERE ${vectorColumn} @@ plainto_tsquery('english', $1)
      ORDER BY rank DESC
      LIMIT $2
    `, [searchTerm, limit]);
  }

  async createPartitionedTable(
    tableName: string,
    partitionColumn: string,
    partitionType: 'RANGE' | 'LIST' | 'HASH' = 'RANGE'
  ): Promise<void> {
    await this.dataSource.query(`
      CREATE TABLE ${tableName}_partitioned (
        LIKE ${tableName} INCLUDING ALL
      ) PARTITION BY ${partitionType} (${partitionColumn})
    `);
  }

  async createMonthlyPartitions(
    tableName: string,
    startDate: Date,
    months: number
  ): Promise<void> {
    for (let i = 0; i < months; i++) {
      const date = new Date(startDate);
      date.setMonth(date.getMonth() + i);
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const partitionName = `${tableName}_${year}_${month}`;
      
      const startOfMonth = new Date(year, date.getMonth(), 1);
      const startOfNextMonth = new Date(year, date.getMonth() + 1, 1);
      
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS ${partitionName}
        PARTITION OF ${tableName}_partitioned
        FOR VALUES FROM ('${startOfMonth.toISOString()}') TO ('${startOfNextMonth.toISOString()}')
      `);
    }
  }

  async createHypertable(tableName: string, timeColumn: string): Promise<void> {
    // For TimescaleDB extension
    await this.dataSource.query(`
      SELECT create_hypertable('${tableName}', '${timeColumn}', if_not_exists => TRUE)
    `);
  }

  async analyzeTableStatistics(tableName: string): Promise<any> {
    return this.dataSource.query(`
      SELECT 
        schemaname,
        tablename,
        attname,
        n_distinct,
        most_common_vals,
        most_common_freqs,
        histogram_bounds
      FROM pg_stats 
      WHERE tablename = $1
    `, [tableName]);
  }

  async getTableSize(tableName: string): Promise<any> {
    return this.dataSource.query(`
      SELECT 
        pg_size_pretty(pg_total_relation_size($1)) as total_size,
        pg_size_pretty(pg_relation_size($1)) as table_size,
        pg_size_pretty(pg_indexes_size($1)) as indexes_size
    `, [tableName]);
  }
}
```

## API Reference

### Repository Classes

#### TypeOrmRepository<T>

Base repository class with PostgreSQL optimizations:

```typescript
export class TypeOrmRepository<T> extends Repository<T> {
  constructor(entity: EntityTarget<T>)
}
```

#### TypeOrmPagingRepository<T>

Repository with built-in pagination support:

```typescript
export class TypeOrmPagingRepository<T> extends TypeOrmRepository<T> {
  async findWithPaging(
    options: FindManyOptions<T>,
    pageParams: PageParams
  ): Promise<PagedData<T>>
}
```

#### RedshiftRepository

Repository for Amazon Redshift operations:

```typescript
export class RedshiftRepository {
  async query(sql: string, parameters?: any[]): Promise<any[]>
  async execute(sql: string, parameters?: any[]): Promise<void>
}
```

### Migration Base Classes

#### TableMigrationBase

Base class for table creation migrations:

```typescript
export abstract class TableMigrationBase {
  protected createTable(queryRunner: QueryRunner, tableName: string, columns: ColumnDefinition[]): Promise<void>
  protected dropTable(queryRunner: QueryRunner, tableName: string): Promise<void>
  protected createIndex(queryRunner: QueryRunner, tableName: string, columns: string[]): Promise<void>
}
```

#### ColumnMigrationBase

Base class for column modifications:

```typescript
export abstract class ColumnMigrationBase {
  protected addColumn(queryRunner: QueryRunner, tableName: string, columnName: string, type: string, options?: ColumnOptions): Promise<void>
  protected dropColumn(queryRunner: QueryRunner, tableName: string, columnName: string): Promise<void>
  protected changeColumn(queryRunner: QueryRunner, tableName: string, columnName: string, newType: string): Promise<void>
}
```

### SQL Writer

#### SqlWriter

Advanced SQL query builder:

```typescript
export class SqlWriter {
  constructor(dataSource: DataSource)
  
  select(columns: string[]): SqlWriter
  from(table: string, alias?: string): SqlWriter
  leftJoin(table: string, alias: string, condition: string): SqlWriter
  where(condition: string, parameters?: Record<string, any>): SqlWriter
  groupBy(columns: string[]): SqlWriter
  orderBy(column: string, direction?: 'ASC' | 'DESC'): SqlWriter
  execute(): Promise<any[]>
}
```

### Type Definitions

#### TableMeta

Table metadata type:

```typescript
interface TableMeta {
  name: string;
  schema?: string;
  columns: ColumnMeta[];
  indexes: IndexMeta[];
}
```

## Best Practices

1. **Use Indexes Wisely**: Create appropriate indexes for query performance
2. **Leverage JSONB**: Use JSONB for flexible schema requirements
3. **Partition Large Tables**: Use table partitioning for time-series data
4. **Full-Text Search**: Implement PostgreSQL full-text search for text queries
5. **Connection Pooling**: Configure proper connection pooling
6. **Migration Strategy**: Use structured migration classes
7. **Monitor Performance**: Use PostgreSQL statistics for performance monitoring
8. **Backup Strategy**: Implement regular backup procedures

## Performance Optimization

```typescript
// Example of optimized queries
const optimizedQuery = repository
  .createQueryBuilder('user')
  .select(['user.id', 'user.email']) // Select only needed columns
  .where('user.isActive = :active', { active: true })
  .andWhere('user.createdAt > :date', { date: cutoffDate })
  .orderBy('user.createdAt', 'DESC')
  .limit(100)
  .getMany();

// Use indexes for better performance
@Index(['email']) // Single column index
@Index(['isActive', 'createdAt']) // Composite index
export class User {
  // Entity definition
}
```

## Testing

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let repository: Repository<User>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useClass: Repository,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should perform full-text search', async () => {
    const searchResults = await service.searchUsers('john doe');
    expect(searchResults.data).toBeDefined();
    expect(Array.isArray(searchResults.data)).toBe(true);
  });
});
```

## License

This library is part of the Onivoro monorepo ecosystem.