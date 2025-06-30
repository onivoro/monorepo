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
    return this.find({ where: { isActive: true } });
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

### Advanced Repository Usage

```typescript
import { Injectable } from '@nestjs/common';
import { TypeOrmPagingRepository, PageParams, PagedData } from '@onivoro/server-typeorm-mysql';
import { User } from './user.entity';
import { FindOptionsWhere, Like, Between } from 'typeorm';

@Injectable()
export class AdvancedUserRepository extends TypeOrmPagingRepository<User> {
  constructor() {
    super(User);
  }

  async searchUsers(
    searchTerm: string,
    pageParams: PageParams
  ): Promise<PagedData<User>> {
    const where: FindOptionsWhere<User> = [
      { firstName: Like(`%${searchTerm}%`) },
      { lastName: Like(`%${searchTerm}%`) },
      { email: Like(`%${searchTerm}%`) }
    ];

    return this.findWithPaging(
      { 
        where,
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

    return this.find({
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
    const [total, active, recentlyRegistered] = await Promise.all([
      this.count(),
      this.count({ where: { isActive: true } }),
      this.count({
        where: {
          createdAt: Between(
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
            new Date()
          )
        }
      })
    ]);

    return {
      total,
      active,
      inactive: total - active,
      recentlyRegistered
    };
  }

  async bulkUpdateUsers(
    userIds: number[],
    updateData: Partial<User>
  ): Promise<void> {
    await this.update(userIds, updateData);
  }

  async softDeleteUsers(userIds: number[]): Promise<void> {
    await this.update(userIds, { isActive: false });
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
import { InjectRepository } from '@nestjs/typeorm';
import { AdvancedUserRepository } from './user.repository';
import { User } from './user.entity';
import { PageParams, PagedData } from '@onivoro/server-typeorm-mysql';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: AdvancedUserRepository
  ) {}

  async createUser(userData: Partial<User>): Promise<User> {
    const user = this.userRepository.create(userData);
    return this.userRepository.save(user);
  }

  async findUserById(id: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async updateUser(id: number, updateData: Partial<User>): Promise<User> {
    const user = await this.findUserById(id);
    Object.assign(user, updateData);
    return this.userRepository.save(user);
  }

  async deleteUser(id: number): Promise<void> {
    const user = await this.findUserById(id);
    await this.userRepository.softDeleteUsers([id]);
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
  getPagingKey 
} from '@onivoro/server-typeorm-mysql';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from './order.entity';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>
  ) {}

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

    const [orders, total] = await this.orderRepository.findAndCount({
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
    
    const queryBuilder = this.orderRepository.createQueryBuilder('order')
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
import { DataSource } from 'typeorm';
import { User } from './user.entity';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';

@Injectable()
export class OrderTransactionService {
  constructor(private dataSource: DataSource) {}

  async createOrderWithItems(
    userId: number,
    orderData: Partial<Order>,
    items: Array<{productId: number, quantity: number, unitPrice: number}>
  ): Promise<Order> {
    return this.dataSource.transaction(async manager => {
      // Create the order
      const order = manager.create(Order, {
        ...orderData,
        userId,
        totalAmount: 0 // Will be calculated
      });
      
      const savedOrder = await manager.save(order);

      // Create order items
      let totalAmount = 0;
      const orderItems = [];

      for (const itemData of items) {
        const totalPrice = itemData.quantity * itemData.unitPrice;
        totalAmount += totalPrice;

        const orderItem = manager.create(OrderItem, {
          orderId: savedOrder.id,
          productId: itemData.productId,
          quantity: itemData.quantity,
          unitPrice: itemData.unitPrice,
          totalPrice
        });

        orderItems.push(await manager.save(orderItem));
      }

      // Update order total
      savedOrder.totalAmount = totalAmount;
      await manager.save(savedOrder);

      // Update user's last order date
      await manager.update(User, userId, { 
        updatedAt: new Date() 
      });

      return savedOrder;
    });
  }

  async transferOrderToNewUser(
    orderId: number,
    newUserId: number
  ): Promise<void> {
    await this.dataSource.transaction(async manager => {
      // Update order
      await manager.update(Order, orderId, { 
        userId: newUserId,
        updatedAt: new Date()
      });

      // Log the transfer
      await manager.query(
        'INSERT INTO order_transfers (order_id, new_user_id, transferred_at) VALUES (?, ?, ?)',
        [orderId, newUserId, new Date()]
      );
    });
  }
}
```

### Custom Query Builder

```typescript
import { Injectable } from '@nestjs/common';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from './order.entity';

@Injectable()
export class OrderQueryService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>
  ) {}

  createBaseQuery(): SelectQueryBuilder<Order> {
    return this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product');
  }

  async findOrdersWithFilters(filters: {
    status?: string[];
    userIds?: number[];
    minAmount?: number;
    maxAmount?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    let query = this.createBaseQuery();

    if (filters.status?.length) {
      query = query.andWhere('order.status IN (:...statuses)', { 
        statuses: filters.status 
      });
    }

    if (filters.userIds?.length) {
      query = query.andWhere('order.userId IN (:...userIds)', { 
        userIds: filters.userIds 
      });
    }

    if (filters.minAmount !== undefined) {
      query = query.andWhere('order.totalAmount >= :minAmount', { 
        minAmount: filters.minAmount 
      });
    }

    if (filters.maxAmount !== undefined) {
      query = query.andWhere('order.totalAmount <= :maxAmount', { 
        maxAmount: filters.maxAmount 
      });
    }

    if (filters.startDate) {
      query = query.andWhere('order.createdAt >= :startDate', { 
        startDate: filters.startDate 
      });
    }

    if (filters.endDate) {
      query = query.andWhere('order.createdAt <= :endDate', { 
        endDate: filters.endDate 
      });
    }

    query = query.orderBy('order.createdAt', 'DESC');

    if (filters.limit) {
      query = query.take(filters.limit);
    }

    if (filters.offset) {
      query = query.skip(filters.offset);
    }

    return query.getManyAndCount();
  }

  async getOrderSummaryByUser(userId: number) {
    return this.orderRepository
      .createQueryBuilder('order')
      .select([
        'COUNT(order.id) as orderCount',
        'SUM(order.totalAmount) as totalSpent',
        'AVG(order.totalAmount) as averageOrderValue',
        'MAX(order.createdAt) as lastOrderDate',
        'MIN(order.createdAt) as firstOrderDate'
      ])
      .where('order.userId = :userId', { userId })
      .andWhere('order.status != :cancelledStatus', { cancelledStatus: 'cancelled' })
      .getRawOne();
  }

  async getTopCustomers(limit: number = 10) {
    return this.orderRepository
      .createQueryBuilder('order')
      .leftJoin('order.user', 'user')
      .select([
        'user.id as userId',
        'user.firstName as firstName',
        'user.lastName as lastName',
        'user.email as email',
        'COUNT(order.id) as orderCount',
        'SUM(order.totalAmount) as totalSpent'
      ])
      .where('order.status != :cancelledStatus', { cancelledStatus: 'cancelled' })
      .groupBy('user.id')
      .orderBy('totalSpent', 'DESC')
      .limit(limit)
      .getRawMany();
  }
}
```

## API Reference

### Repository Classes

#### TypeOrmRepository<T>

Base repository class with enhanced functionality:

```typescript
export class TypeOrmRepository<T> extends Repository<T> {
  constructor(entity: EntityTarget<T>)
  
  // Enhanced methods with better error handling and utilities
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

## Best Practices

1. **Repository Pattern**: Use custom repositories for complex queries
2. **Transactions**: Use transactions for multi-table operations
3. **Indexing**: Add proper indexes for frequently queried columns
4. **Pagination**: Always implement pagination for list endpoints
5. **Query Optimization**: Use query builders for complex queries
6. **Error Handling**: Implement proper error handling in repositories
7. **Type Safety**: Leverage TypeScript for type-safe database operations
8. **Connection Pooling**: Configure appropriate connection pool settings

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

  it('should create a user', async () => {
    const userData = {
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe'
    };

    jest.spyOn(repository, 'create').mockReturnValue(userData as User);
    jest.spyOn(repository, 'save').mockResolvedValue(userData as User);

    const result = await service.createUser(userData);
    expect(result).toEqual(userData);
  });
});
```

## License

This library is part of the Onivoro monorepo ecosystem.