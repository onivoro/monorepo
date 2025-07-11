# @onivoro/server-typeorm-mysql

A comprehensive TypeORM MySQL integration library for NestJS applications, providing custom repositories, decorators, utilities, and enhanced MySQL-specific functionality for enterprise-scale database operations.

## Installation

```bash
npm install @onivoro/server-typeorm-mysql
```

## Features

- **TypeORM MySQL Module**: Complete NestJS module for MySQL integration
- **Custom Repository Classes**: Enhanced repository patterns with pagination and utilities
- **Custom Decorators**: MySQL-specific column decorators and table definitions
- **Data Source Factory**: Flexible data source configuration and creation
- **Pagination Support**: Built-in pagination utilities and interfaces
- **Query Utilities**: Helper functions for date queries and data manipulation
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **MySQL Optimizations**: MySQL-specific optimizations and best practices

## Quick Start

### Import the Module

```typescript
import { ServerTypeormMysqlModule } from '@onivoro/server-typeorm-mysql';

@Module({
  imports: [
    ServerTypeormMysqlModule.forRoot({
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: 'password',
      database: 'myapp',
      entities: [User, Product, Order],
      synchronize: false,
      logging: true
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
} from '@onivoro/server-typeorm-mysql';
import { Entity } from 'typeorm';

@Entity()
@Table('users')
export class User {
  @PrimaryTableColumn()
  id: number;

  @TableColumn({ type: 'varchar', length: 255 })
  email: string;

  @TableColumn({ type: 'varchar', length: 100 })
  firstName: string;

  @TableColumn({ type: 'varchar', length: 100 })
  lastName: string;

  @NullableTableColumn({ type: 'datetime' })
  lastLoginAt?: Date;

  @TableColumn({ type: 'boolean', default: true })
  isActive: boolean;

  @TableColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @TableColumn({ 
    type: 'timestamp', 
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP'
  })
  updatedAt: Date;
}
```

### Use Custom Repository

```typescript
import { Injectable } from '@nestjs/common';
import { TypeOrmRepository, TypeOrmPagingRepository } from '@onivoro/server-typeorm-mysql';
import { EntityManager } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UserRepository extends TypeOrmPagingRepository<User> {
  constructor(entityManager: EntityManager) {
    super(User, entityManager);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.getOne({ where: { email } });
  }

  async findActiveUsers(): Promise<User[]> {
    return this.getMany({ where: { isActive: true } });
  }

  async findUsersWithPagination(page: number, limit: number) {
    return this.findWithPaging(
      { where: { isActive: true } },
      { page, limit }
    );
  }
}
```

## Configuration

### Data Source Configuration

```typescript
import { dataSourceConfigFactory } from '@onivoro/server-typeorm-mysql';

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
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
```

### Dynamic Module Configuration

```typescript
import { Module } from '@nestjs/common';
import { ServerTypeormMysqlModule } from '@onivoro/server-typeorm-mysql';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ServerTypeormMysqlModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        host: configService.get('DATABASE_HOST'),
        port: configService.get('DATABASE_PORT'),
        username: configService.get('DATABASE_USERNAME'),
        password: configService.get('DATABASE_PASSWORD'),
        database: configService.get('DATABASE_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        synchronize: configService.get('NODE_ENV') === 'development',
        logging: configService.get('DATABASE_LOGGING') === 'true'
      }),
      inject: [ConfigService]
    })
  ],
})
export class DatabaseModule {}
```

## Usage Examples

### Basic Repository Operations

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

  // Create a single user
  async createUser(userData: Partial<User>): Promise<User> {
    return this.postOne(userData);
  }

  // Create multiple users
  async createUsers(usersData: Partial<User>[]): Promise<User[]> {
    return this.postMany(usersData);
  }

  // Find users with filters
  async findUsers(filters: { isActive?: boolean; email?: string }): Promise<User[]> {
    return this.getMany({ where: filters });
  }

  // Find users with count
  async findUsersWithCount(filters: { isActive?: boolean }): Promise<[User[], number]> {
    return this.getManyAndCount({ where: filters });
  }

  // Find a single user
  async findUserById(id: number): Promise<User> {
    return this.getOne({ where: { id } });
  }

  // Update user
  async updateUser(id: number, updateData: Partial<User>): Promise<void> {
    await this.patch({ id }, updateData);
  }

  // Replace user data
  async replaceUser(id: number, userData: Partial<User>): Promise<void> {
    await this.put({ id }, userData);
  }

  // Delete user permanently
  async deleteUser(id: number): Promise<void> {
    await this.delete({ id });
  }

  // Soft delete user
  async softDeleteUser(id: number): Promise<void> {
    await this.softDelete({ id });
  }
}
```

### Advanced Repository Usage with Pagination

```typescript
import { Injectable } from '@nestjs/common';
import { TypeOrmPagingRepository, PageParams, PagedData } from '@onivoro/server-typeorm-mysql';
import { EntityManager, Like, Between } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class AdvancedUserRepository extends TypeOrmPagingRepository<User> {
  constructor(entityManager: EntityManager) {
    super(User, entityManager);
  }

  async searchUsers(
    searchTerm: string,
    pageParams: PageParams
  ): Promise<PagedData<User>> {
    const whereConditions = this.buildWhereILike({
      firstName: searchTerm,
      lastName: searchTerm,
      email: searchTerm
    });

    return this.findWithPaging(
      { 
        where: [
          { firstName: Like(`%${searchTerm}%`) },
          { lastName: Like(`%${searchTerm}%`) },
          { email: Like(`%${searchTerm}%`) }
        ],
        order: { createdAt: 'DESC' }
      },
      pageParams
    );
  }

  async findUsersByDateRange(
    startDate: Date,
    endDate: Date,
    pageParams: PageParams
  ): Promise<PagedData<User>> {
    return this.findWithPaging(
      {
        where: {
          createdAt: Between(startDate, endDate)
        },
        order: { createdAt: 'DESC' }
      },
      pageParams
    );
  }

  async findRecentlyActiveUsers(days: number = 30): Promise<User[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.getMany({
      where: {
        lastLoginAt: Between(cutoffDate, new Date())
      },
      order: { lastLoginAt: 'DESC' }
    });
  }

  async getUserStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    recentlyRegistered: number;
  }> {
    const [allUsers, totalCount] = await this.getManyAndCount({});
    const [activeUsers, activeCount] = await this.getManyAndCount({ 
      where: { isActive: true } 
    });
    const [recentUsers, recentCount] = await this.getManyAndCount({
      where: {
        createdAt: Between(
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          new Date()
        )
      }
    });

    return {
      total: totalCount,
      active: activeCount,
      inactive: totalCount - activeCount,
      recentlyRegistered: recentCount
    };
  }

  async bulkUpdateUsers(
    userIds: number[],
    updateData: Partial<User>
  ): Promise<void> {
    for (const id of userIds) {
      await this.patch({ id }, updateData);
    }
  }

  async softDeleteUsers(userIds: number[]): Promise<void> {
    for (const id of userIds) {
      await this.softDelete({ id });
    }
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
} from '@onivoro/server-typeorm-mysql';
import { Entity, ManyToOne, OneToMany, JoinColumn } from 'typeorm';

@Entity()
@Table('orders')
export class Order {
  @PrimaryTableColumn()
  id: number;

  @TableColumn({ type: 'varchar', length: 50 })
  orderNumber: string;

  @TableColumn({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @TableColumn({ type: 'enum', enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] })
  status: string;

  @TableColumn({ type: 'int' })
  userId: number;

  @TableColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @NullableTableColumn({ type: 'timestamp' })
  shippedAt?: Date;

  @NullableTableColumn({ type: 'timestamp' })
  deliveredAt?: Date;

  // Relationships
  @ManyToOne(() => User, user => user.orders, ManyToOneRelationOptions)
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => OrderItem, orderItem => orderItem.order)
  items: OrderItem[];
}

@Entity()
@Table('order_items')
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

  @ManyToOne(() => Order, order => order.items, ManyToOneRelationOptions)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @ManyToOne(() => Product, product => product.orderItems, ManyToOneRelationOptions)
  @JoinColumn({ name: 'productId' })
  product: Product;
}
```

### Service Layer with Repository

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { AdvancedUserRepository } from './user.repository';
import { User } from './user.entity';
import { PageParams, PagedData } from '@onivoro/server-typeorm-mysql';

@Injectable()
export class UserService {
  constructor(
    private userRepository: AdvancedUserRepository
  ) {}

  async createUser(userData: Partial<User>): Promise<User> {
    return this.userRepository.postOne(userData);
  }

  async findUserById(id: number): Promise<User> {
    const user = await this.userRepository.getOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async updateUser(id: number, updateData: Partial<User>): Promise<void> {
    const user = await this.findUserById(id);
    await this.userRepository.patch({ id }, updateData);
  }

  async deleteUser(id: number): Promise<void> {
    const user = await this.findUserById(id);
    await this.userRepository.softDelete({ id });
  }

  async searchUsers(
    searchTerm: string,
    pageParams: PageParams
  ): Promise<PagedData<User>> {
    return this.userRepository.searchUsers(searchTerm, pageParams);
  }

  async getUserStatistics() {
    return this.userRepository.getUserStatistics();
  }

  async getRecentlyActiveUsers(days: number = 30): Promise<User[]> {
    return this.userRepository.findRecentlyActiveUsers(days);
  }

  async bulkUpdateUsers(userIds: number[], updateData: Partial<User>): Promise<void> {
    await this.userRepository.bulkUpdateUsers(userIds, updateData);
  }
}
```

### Query Utilities Usage

```typescript
import { Injectable } from '@nestjs/common';
import { 
  generateDateQuery, 
  removeFalseyKeys,
  getSkip,
  getPagingKey,
  TypeOrmRepository
} from '@onivoro/server-typeorm-mysql';
import { EntityManager } from 'typeorm';
import { Order } from './order.entity';

@Injectable()
export class OrderService extends TypeOrmRepository<Order> {
  constructor(entityManager: EntityManager) {
    super(Order, entityManager);
  }

  async findOrdersByDateRange(
    startDate?: Date,
    endDate?: Date,
    status?: string,
    page: number = 1,
    limit: number = 10
  ) {
    const whereConditions: any = removeFalseyKeys({
      status,
      ...generateDateQuery('createdAt', startDate, endDate)
    });

    const skip = getSkip(page, limit);

    const [orders, total] = await this.getManyAndCount({
      where: whereConditions,
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: ['user', 'items', 'items.product']
    });

    return {
      data: orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        key: getPagingKey(page, limit)
      }
    };
  }

  async getOrderAnalytics(startDate: Date, endDate: Date) {
    const dateQuery = generateDateQuery('createdAt', startDate, endDate);
    
    const queryBuilder = this.repo.createQueryBuilder('order')
      .where(dateQuery);

    const [
      totalOrders,
      totalRevenue,
      averageOrderValue,
      statusBreakdown
    ] = await Promise.all([
      queryBuilder.getCount(),
      queryBuilder
        .select('SUM(order.totalAmount)', 'total')
        .getRawOne()
        .then(result => result.total || 0),
      queryBuilder
        .select('AVG(order.totalAmount)', 'average')
        .getRawOne()
        .then(result => result.average || 0),
      queryBuilder
        .select('order.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('order.status')
        .getRawMany()
    ]);

    return {
      totalOrders,
      totalRevenue: parseFloat(totalRevenue),
      averageOrderValue: parseFloat(averageOrderValue),
      statusBreakdown: statusBreakdown.reduce((acc, item) => {
        acc[item.status] = parseInt(item.count);
        return acc;
      }, {})
    };
  }
}
```

### Database Transactions

```typescript
import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { TypeOrmRepository } from '@onivoro/server-typeorm-mysql';
import { User } from './user.entity';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';

@Injectable()
export class OrderTransactionService {
  constructor(private entityManager: EntityManager) {}

  async createOrderWithItems(
    userId: number,
    orderData: Partial<Order>,
    items: Array<{productId: number, quantity: number, unitPrice: number}>
  ): Promise<Order> {
    return this.entityManager.transaction(async transactionalEntityManager => {
      const orderRepo = new TypeOrmRepository<Order>(Order, transactionalEntityManager);
      const orderItemRepo = new TypeOrmRepository<OrderItem>(OrderItem, transactionalEntityManager);
      const userRepo = new TypeOrmRepository<User>(User, transactionalEntityManager);

      // Create the order
      const order = await orderRepo.postOne({
        ...orderData,
        userId,
        totalAmount: 0 // Will be calculated
      });

      // Create order items
      let totalAmount = 0;
      const orderItems = [];

      for (const itemData of items) {
        const totalPrice = itemData.quantity * itemData.unitPrice;
        totalAmount += totalPrice;

        const orderItem = await orderItemRepo.postOne({
          orderId: order.id,
          productId: itemData.productId,
          quantity: itemData.quantity,
          unitPrice: itemData.unitPrice,
          totalPrice
        });

        orderItems.push(orderItem);
      }

      // Update order total
      await orderRepo.patch({ id: order.id }, { totalAmount });

      // Update user's last order date
      await userRepo.patch({ id: userId }, { 
        updatedAt: new Date() 
      });

      return order;
    });
  }

  async transferOrderToNewUser(
    orderId: number,
    newUserId: number
  ): Promise<void> {
    await this.entityManager.transaction(async transactionalEntityManager => {
      const orderRepo = new TypeOrmRepository<Order>(Order, transactionalEntityManager);

      // Update order
      await orderRepo.patch({ id: orderId }, { 
        userId: newUserId,
        updatedAt: new Date()
      });

      // Log the transfer using raw query
      await transactionalEntityManager.query(
        'INSERT INTO order_transfers (order_id, new_user_id, transferred_at) VALUES (?, ?, ?)',
        [orderId, newUserId, new Date()]
      );
    });
  }
}
```

### Query Streaming

```typescript
import { Injectable } from '@nestjs/common';
import { TypeOrmRepository } from '@onivoro/server-typeorm-mysql';
import { EntityManager, QueryRunner } from 'typeorm';
import { User } from './user.entity';
import { createWriteStream } from 'fs';

@Injectable()
export class UserStreamingService extends TypeOrmRepository<User> {
  constructor(entityManager: EntityManager) {
    super(User, entityManager);
  }

  async exportUsersToFile(filePath: string): Promise<void> {
    const writeStream = createWriteStream(filePath);
    
    writeStream.write('id,email,firstName,lastName,createdAt\n');

    const { stream, error } = await this.queryStream({
      query: 'SELECT id, email, firstName, lastName, createdAt FROM users WHERE isActive = 1',
      onData: async (stream, record: User, count) => {
        const csvLine = `${record.id},"${record.email}","${record.firstName}","${record.lastName}","${record.createdAt}"\n`;
        writeStream.write(csvLine);
        
        if (count % 1000 === 0) {
          console.log(`Processed ${count} records`);
        }
      },
      onError: async (stream, error) => {
        console.error('Stream error:', error);
        writeStream.end();
      },
      onEnd: async (stream, count) => {
        console.log(`Export completed. Total records: ${count}`);
        writeStream.end();
      }
    });

    if (error) {
      throw new Error(`Failed to start streaming: ${error.message}`);
    }
  }

  async processLargeDataset(): Promise<void> {
    const { stream, error } = await this.queryStream({
      query: 'SELECT * FROM users WHERE createdAt > DATE_SUB(NOW(), INTERVAL 1 YEAR)',
      onData: async (stream, record: User, count) => {
        // Process each record individually
        // This is memory efficient for large datasets
        await this.processUserRecord(record);
      },
      onError: async (stream, error) => {
        console.error('Processing error:', error);
      },
      onEnd: async (stream, count) => {
        console.log(`Processed ${count} user records`);
      }
    });

    if (error) {
      throw new Error(`Failed to process dataset: ${error.message}`);
    }
  }

  private async processUserRecord(user: User): Promise<void> {
    // Your custom processing logic here
    console.log(`Processing user: ${user.email}`);
  }

  // Static method usage for custom query runners
  static async streamWithCustomQueryRunner(
    queryRunner: QueryRunner,
    query: string
  ): Promise<void> {
    const { stream, error } = await TypeOrmRepository.queryStream(queryRunner, {
      query,
      onData: async (stream, record, count) => {
        console.log(`Record ${count}:`, record);
      },
      onEnd: async (stream, count) => {
        console.log(`Stream completed with ${count} records`);
      }
    });

    if (error) {
      console.error('Stream failed:', error);
    }
  }
}
```

## API Reference

### Repository Classes

#### TypeOrmRepository<T>

Base repository class with enhanced functionality:

```typescript
export class TypeOrmRepository<T> {
  constructor(entityType: any, entityManager: EntityManager)
  
  // Core CRUD methods
  async getMany(options: FindManyOptions<T>): Promise<T[]>
  async getManyAndCount(options: FindManyOptions<T>): Promise<[T[], number]>
  async getOne(options: FindOneOptions<T>): Promise<T>
  async postOne(body: Partial<T>): Promise<T>
  async postMany(body: Partial<T>[]): Promise<T[]>
  async delete(options: FindOptionsWhere<T>): Promise<void>
  async softDelete(options: FindOptionsWhere<T>): Promise<void>
  async put(options: FindOptionsWhere<T>, body: QueryDeepPartialEntity<T>): Promise<void>
  async patch(options: FindOptionsWhere<T>, body: QueryDeepPartialEntity<T>): Promise<void>
  
  // Transaction support
  forTransaction(entityManager: EntityManager): TypeOrmRepository<T>
  
  // Streaming support
  async queryStream<TRecord = any>(params: TQueryStreamParams): Promise<{stream: any, error: any}>
  static async queryStream<TRecord = any>(queryRunner: QueryRunner, params: TQueryStreamParams): Promise<{stream: any, error: any}>
  
  // Utility methods
  buildWhereILike(filters?: Record<string, any>): FindOptionsWhere<T>
  
  // Internal properties
  get repo(): Repository<T>
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

### Decorators

#### @Table(name?: string)

Enhanced table decorator:

```typescript
@Table('table_name')
export class Entity {}
```

#### @PrimaryTableColumn(options?)

Primary key column decorator:

```typescript
@PrimaryTableColumn()
id: number;
```

#### @TableColumn(options)

Standard column decorator:

```typescript
@TableColumn({ type: 'varchar', length: 255 })
name: string;
```

#### @NullableTableColumn(options)

Nullable column decorator:

```typescript
@NullableTableColumn({ type: 'datetime' })
deletedAt?: Date;
```

### Utility Functions

#### dataSourceConfigFactory(options)

Create data source configuration:

```typescript
function dataSourceConfigFactory(options: DataSourceOptions): DataSourceOptions
```

#### generateDateQuery(field, startDate?, endDate?)

Generate date range query conditions:

```typescript
function generateDateQuery(
  field: string,
  startDate?: Date,
  endDate?: Date
): Record<string, any>
```

#### removeFalseyKeys(object)

Remove falsy values from object:

```typescript
function removeFalseyKeys<T>(obj: T): Partial<T>
```

### Type Definitions

#### PageParams

Pagination parameters:

```typescript
interface PageParams {
  page: number;
  limit: number;
}
```

#### PagedData<T>

Paginated response data:

```typescript
interface PagedData<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
```

#### TQueryStreamParams

Query streaming parameters:

```typescript
type TQueryStreamParams<TRecord = any> = {
  query: string;
  onData?: (stream: ReadStream, record: TRecord, count: number) => Promise<any | void>;
  onError?: (stream: ReadStream, error: any) => Promise<any | void>;
  onEnd?: (stream: ReadStream, count: number) => Promise<any | void>;
};
```

## Best Practices

1. **Repository Pattern**: Use custom repositories extending TypeOrmRepository for domain-specific operations
2. **Transactions**: Use `forTransaction()` method for multi-table operations
3. **Indexing**: Add proper indexes for frequently queried columns
4. **Pagination**: Always implement pagination using TypeOrmPagingRepository for list operations
5. **Streaming**: Use `queryStream()` for processing large datasets efficiently
6. **Error Handling**: Implement proper error handling in repositories and services
7. **Type Safety**: Leverage TypeScript for type-safe database operations
8. **Connection Pooling**: Configure appropriate connection pool settings

## Testing

```typescript
import { Test } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import { User } from './user.entity';
import { UserService } from './user.service';
import { AdvancedUserRepository } from './user.repository';

describe('UserService', () => {
  let service: UserService;
  let repository: AdvancedUserRepository;
  let entityManager: EntityManager;

  beforeEach(async () => {
    const mockEntityManager = {
      getRepository: jest.fn().mockReturnValue({
        find: jest.fn(),
        findAndCount: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        softDelete: jest.fn(),
        createQueryBuilder: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnThis(),
          values: jest.fn().mockReturnThis(),
          returning: jest.fn().mockReturnThis(),
          execute: jest.fn()
        })
      })
    };

    const module = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: AdvancedUserRepository,
          useFactory: () => new AdvancedUserRepository(mockEntityManager as any)
        },
        {
          provide: EntityManager,
          useValue: mockEntityManager
        }
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    repository = module.get<AdvancedUserRepository>(AdvancedUserRepository);
    entityManager = module.get<EntityManager>(EntityManager);
  });

  it('should create a user', async () => {
    const userData = {
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe'
    };

    const createdUser = { id: 1, ...userData };
    jest.spyOn(repository, 'postOne').mockResolvedValue(createdUser as User);

    const result = await service.createUser(userData);
    expect(result).toEqual(createdUser);
  });

  it('should find user by id', async () => {
    const user = { id: 1, email: 'test@example.com', firstName: 'John', lastName: 'Doe' };
    jest.spyOn(repository, 'getOne').mockResolvedValue(user as User);

    const result = await service.findUserById(1);
    expect(result).toEqual(user);
  });
});
```

## License

This library is licensed under the MIT License. See the LICENSE file in this package for details.