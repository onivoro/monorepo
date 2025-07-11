# @onivoro/server-aws-redshift

A NestJS module for integrating with AWS Redshift Data API and Redshift Serverless, providing SQL query execution, database management, user management, and data warehouse operations for your server applications.

## Installation

```bash
npm install @onivoro/server-aws-redshift
```

## Features

- **SQL Query Execution**: Execute SQL queries using Redshift Data API
- **Async Query Processing**: Non-blocking query execution with result polling
- **User Management**: Create and manage Redshift database users
- **Group Management**: Create and manage database groups with IAM integration
- **Permission Management**: Grant schema and table permissions
- **Workgroup Integration**: Support for Redshift Serverless workgroups
- **Connection Management**: Automatic endpoint verification and access control
- **Error Handling**: Comprehensive error handling for database operations

## Quick Start

### 1. Module Configuration

```typescript
import { ServerAwsRedshiftModule } from '@onivoro/server-aws-redshift';

@Module({
  imports: [
    ServerAwsRedshiftModule.configure({
      AWS_REGION: 'us-east-1',
      REDSHIFT_DATABASE: process.env.REDSHIFT_DATABASE,
      REDSHIFT_WORKGROUP: process.env.REDSHIFT_WORKGROUP,
      AWS_PROFILE: process.env.AWS_PROFILE || 'default',
    }),
  ],
})
export class AppModule {}
```

### 2. Basic Usage

```typescript
import { RedshiftDataService } from '@onivoro/server-aws-redshift';

@Injectable()
export class DataWarehouseService {
  constructor(private redshiftService: RedshiftDataService) {}

  async executeQuery(sql: string) {
    const queryParams = {
      database: process.env.REDSHIFT_DATABASE!,
      workgroupName: process.env.REDSHIFT_WORKGROUP!
    };

    return this.redshiftService.query(queryParams, sql);
  }

  async createUser(username: string) {
    const queryParams = {
      database: process.env.REDSHIFT_DATABASE!,
      workgroupName: process.env.REDSHIFT_WORKGROUP!
    };

    return this.redshiftService.createDatabaseUser({
      ...queryParams,
      user: username
    });
  }

  async verifyConnection() {
    return this.redshiftService.verifyEndpointAccess(process.env.REDSHIFT_WORKGROUP!);
  }
}
```

## Configuration

### ServerAwsRedshiftConfig

```typescript
import { ServerAwsRedshiftConfig } from '@onivoro/server-aws-redshift';

export class AppRedshiftConfig extends ServerAwsRedshiftConfig {
  AWS_REGION = process.env.AWS_REGION || 'us-east-1';
  REDSHIFT_DATABASE = process.env.REDSHIFT_DATABASE || 'dev';
  REDSHIFT_WORKGROUP = process.env.REDSHIFT_WORKGROUP || 'default';
  REDSHIFT_CLUSTER_IDENTIFIER = process.env.REDSHIFT_CLUSTER_IDENTIFIER;
  AWS_PROFILE = process.env.AWS_PROFILE || 'default';
  QUERY_TIMEOUT = parseInt(process.env.REDSHIFT_QUERY_TIMEOUT) || 300000; // 5 minutes
  MAX_RETRY_ATTEMPTS = parseInt(process.env.REDSHIFT_MAX_RETRIES) || 3;
}
```

### Environment Variables

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_PROFILE=default

# Redshift Configuration
REDSHIFT_DATABASE=analytics
REDSHIFT_WORKGROUP=analytics-workgroup
REDSHIFT_CLUSTER_IDENTIFIER=my-redshift-cluster
REDSHIFT_QUERY_TIMEOUT=300000
REDSHIFT_MAX_RETRIES=3
```

## Services

### RedshiftDataService

The main service for Redshift operations:

```typescript
import { RedshiftDataService } from '@onivoro/server-aws-redshift';

@Injectable()
export class AnalyticsService {
  constructor(private redshiftService: RedshiftDataService) {}

  async getUserAnalytics(userId: string, startDate: string, endDate: string) {
    const sql = `
      SELECT 
        date_trunc('day', event_timestamp) as date,
        count(*) as event_count,
        count(distinct session_id) as session_count
      FROM user_events 
      WHERE user_id = '${userId}'
        AND event_timestamp BETWEEN '${startDate}' AND '${endDate}'
      GROUP BY date_trunc('day', event_timestamp)
      ORDER BY date
    `;

    return this.redshiftService.query({
      database: process.env.REDSHIFT_DATABASE!,
      workgroupName: process.env.REDSHIFT_WORKGROUP!
    }, sql);
  }

  async createAnalyticsUser(username: string) {
    const queryParams = {
      database: process.env.REDSHIFT_DATABASE!,
      workgroupName: process.env.REDSHIFT_WORKGROUP!
    };

    // Create user
    const password = await this.redshiftService.createDatabaseUser({
      ...queryParams,
      user: username
    });

    // Create analytics group if it doesn't exist
    await this.redshiftService.createDbGroupFromIamGroupIfNotExists({
      ...queryParams,
      iamGroup: 'analytics-users'
    });

    // Add user to group
    await this.redshiftService.addIamUserToDatabaseGroup({
      ...queryParams,
      user: username,
      group: 'analytics-users'
    });

    // Grant permissions
    await this.redshiftService.grantUsageOnSchema({
      ...queryParams,
      schema: 'analytics',
      group: 'analytics-users'
    });

    return { username, password };
  }
}
```

## Usage Examples

### Data Analytics Service

```typescript
import { RedshiftDataService } from '@onivoro/server-aws-redshift';

@Injectable()
export class DataAnalyticsService {
  constructor(private redshiftService: RedshiftDataService) {}

  async runDailyReport(reportDate: string) {
    const sql = `
      INSERT INTO daily_reports (report_date, total_users, total_orders, revenue)
      SELECT 
        '${reportDate}' as report_date,
        count(distinct user_id) as total_users,
        count(distinct order_id) as total_orders,
        sum(order_amount) as revenue
      FROM fact_orders
      WHERE order_date = '${reportDate}'
    `;

    return this.redshiftService.query({
      database: process.env.REDSHIFT_DATABASE!,
      workgroupName: process.env.REDSHIFT_WORKGROUP!
    }, sql);
  }

  async getCustomerSegmentation() {
    const sql = `
      WITH customer_metrics AS (
        SELECT 
          user_id,
          count(*) as order_count,
          sum(order_amount) as total_spent,
          max(order_date) as last_order_date,
          min(order_date) as first_order_date
        FROM fact_orders
        WHERE order_date >= current_date - interval '365 days'
        GROUP BY user_id
      )
      SELECT 
        CASE 
          WHEN total_spent > 1000 AND order_count > 10 THEN 'VIP'
          WHEN total_spent > 500 OR order_count > 5 THEN 'Regular'
          ELSE 'Casual'
        END as segment,
        count(*) as customer_count,
        avg(total_spent) as avg_spent,
        avg(order_count) as avg_orders
      FROM customer_metrics
      GROUP BY 1
      ORDER BY avg_spent DESC
    `;

    return this.redshiftService.query({
      database: process.env.REDSHIFT_DATABASE!,
      workgroupName: process.env.REDSHIFT_WORKGROUP!
    }, sql);
  }

  async getCohortAnalysis(startDate: string, endDate: string) {
    const sql = `
      WITH user_cohorts AS (
        SELECT 
          user_id,
          date_trunc('month', min(order_date)) as cohort_month
        FROM fact_orders
        WHERE order_date BETWEEN '${startDate}' AND '${endDate}'
        GROUP BY user_id
      ),
      cohort_sizes AS (
        SELECT 
          cohort_month,
          count(*) as cohort_size
        FROM user_cohorts
        GROUP BY cohort_month
      ),
      cohort_retention AS (
        SELECT 
          c.cohort_month,
          date_trunc('month', o.order_date) as order_month,
          count(distinct o.user_id) as retained_users
        FROM user_cohorts c
        JOIN fact_orders o ON c.user_id = o.user_id
        WHERE o.order_date >= c.cohort_month
        GROUP BY c.cohort_month, date_trunc('month', o.order_date)
      )
      SELECT 
        cr.cohort_month,
        cr.order_month,
        cs.cohort_size,
        cr.retained_users,
        round(100.0 * cr.retained_users / cs.cohort_size, 2) as retention_rate
      FROM cohort_retention cr
      JOIN cohort_sizes cs ON cr.cohort_month = cs.cohort_month
      ORDER BY cr.cohort_month, cr.order_month
    `;

    return this.redshiftService.query({
      database: process.env.REDSHIFT_DATABASE!,
      workgroupName: process.env.REDSHIFT_WORKGROUP!
    }, sql);
  }
}
```

### ETL Pipeline Service

```typescript
import { RedshiftDataService } from '@onivoro/server-aws-redshift';

@Injectable()
export class ETLPipelineService {
  constructor(private redshiftService: RedshiftDataService) {}

  async loadDataFromS3(tableName: string, s3Path: string, copyOptions?: string) {
    const sql = `
      COPY ${tableName}
      FROM '${s3Path}'
      IAM_ROLE 'arn:aws:iam::123456789012:role/RedshiftRole'
      ${copyOptions || 'CSV IGNOREHEADER 1'}
    `;

    return this.redshiftService.query({
      database: process.env.REDSHIFT_DATABASE!,
      workgroupName: process.env.REDSHIFT_WORKGROUP!
    }, sql);
  }

  async unloadDataToS3(tableName: string, s3Path: string, whereClause?: string) {
    const sql = `
      UNLOAD ('SELECT * FROM ${tableName} ${whereClause || ''}')
      TO '${s3Path}'
      IAM_ROLE 'arn:aws:iam::123456789012:role/RedshiftRole'
      CSV HEADER
    `;

    return this.redshiftService.query({
      database: process.env.REDSHIFT_DATABASE!,
      workgroupName: process.env.REDSHIFT_WORKGROUP!
    }, sql);
  }

  async createFactTable(tableName: string, schema: TableSchema) {
    const columns = schema.columns.map(col => 
      `${col.name} ${col.dataType}${col.nullable ? '' : ' NOT NULL'}${col.primary ? ' PRIMARY KEY' : ''}`
    ).join(',\n  ');

    const sql = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columns}
      )
      ${schema.distKey ? `DISTKEY(${schema.distKey})` : ''}
      ${schema.sortKeys ? `SORTKEY(${schema.sortKeys.join(', ')})` : ''}
    `;

    return this.redshiftService.query({
      database: process.env.REDSHIFT_DATABASE!,
      workgroupName: process.env.REDSHIFT_WORKGROUP!
    }, sql);
  }

  async runDataQualityChecks(tableName: string) {
    const checks = [
      // Check for null values in required columns
      `SELECT 'null_check' as test, count(*) as failures FROM ${tableName} WHERE id IS NULL`,
      
      // Check for duplicate records
      `SELECT 'duplicate_check' as test, count(*) - count(distinct id) as failures FROM ${tableName}`,
      
      // Check for future dates
      `SELECT 'future_date_check' as test, count(*) as failures FROM ${tableName} WHERE created_at > current_date`,
    ];

    const results = [];
    for (const check of checks) {
      const result = await this.redshiftService.query({
        database: process.env.REDSHIFT_DATABASE!,
        workgroupName: process.env.REDSHIFT_WORKGROUP!
      }, check);
      results.push(result);
    }

    return results;
  }

  async optimizeTable(tableName: string) {
    // Vacuum to reclaim space
    await this.redshiftService.query({
      database: process.env.REDSHIFT_DATABASE!,
      workgroupName: process.env.REDSHIFT_WORKGROUP!
    }, `VACUUM ${tableName}`);

    // Analyze to update statistics
    await this.redshiftService.query({
      database: process.env.REDSHIFT_DATABASE!,
      workgroupName: process.env.REDSHIFT_WORKGROUP!
    }, `ANALYZE ${tableName}`);

    console.log(`Table ${tableName} optimized successfully`);
  }
}
```

### User and Permission Management

```typescript
import { RedshiftDataService } from '@onivoro/server-aws-redshift';

@Injectable()
export class RedshiftUserManagementService {
  constructor(private redshiftService: RedshiftDataService) {}

  async setupDepartmentAccess(department: string, users: string[], schemas: string[]) {
    const queryParams = {
      database: process.env.REDSHIFT_DATABASE!,
      workgroupName: process.env.REDSHIFT_WORKGROUP!
    };

    // Create department group
    await this.redshiftService.createDbGroupFromIamGroupIfNotExists({
      ...queryParams,
      iamGroup: `${department}-group`
    });

    // Create users and add to group
    for (const user of users) {
      await this.redshiftService.createDatabaseUser({
        ...queryParams,
        user
      });

      await this.redshiftService.addIamUserToDatabaseGroup({
        ...queryParams,
        user,
        group: `${department}-group`
      });
    }

    // Grant schema permissions
    for (const schema of schemas) {
      await this.redshiftService.grantUsageOnSchema({
        ...queryParams,
        schema,
        group: `${department}-group`
      });
    }

    return {
      department,
      groupName: `${department}-group`,
      usersCreated: users.length,
      schemasGranted: schemas.length
    };
  }

  async auditUserPermissions() {
    const sql = `
      SELECT 
        u.usename as username,
        g.groname as group_name,
        s.schemaname as schema_name,
        p.privilege_type
      FROM pg_user u
      LEFT JOIN pg_group g ON u.usesysid = ANY(g.grolist)
      LEFT JOIN information_schema.schema_privileges p ON g.groname = p.grantee
      LEFT JOIN information_schema.schemata s ON p.schema_name = s.schema_name
      WHERE u.usename NOT LIKE 'rdsdb%'
      ORDER BY u.usename, g.groname, s.schemaname
    `;

    return this.redshiftService.query({
      database: process.env.REDSHIFT_DATABASE!,
      workgroupName: process.env.REDSHIFT_WORKGROUP!
    }, sql);
  }

  async getIamRoleAssociations() {
    return this.redshiftService.getAssociatedIAmRolesByWorkgroup({
      database: process.env.REDSHIFT_DATABASE!,
      workgroupName: process.env.REDSHIFT_WORKGROUP!
    });
  }

  async cleanupInactiveUsers(inactiveDays: number = 90) {
    const sql = `
      SELECT usename
      FROM pg_user
      WHERE usename NOT LIKE 'rdsdb%'
        AND usename NOT IN (
          SELECT DISTINCT usename
          FROM stl_query
          WHERE starttime > current_date - interval '${inactiveDays} days'
        )
    `;

    const inactiveUsers = await this.redshiftService.query({
      database: process.env.REDSHIFT_DATABASE!,
      workgroupName: process.env.REDSHIFT_WORKGROUP!
    }, sql);

    console.log(`Found ${inactiveUsers.length} inactive users`);
    return inactiveUsers;
  }
}
```

### Query Monitoring and Performance

```typescript
import { RedshiftDataService } from '@onivoro/server-aws-redshift';

@Injectable()
export class RedshiftMonitoringService {
  constructor(private redshiftService: RedshiftDataService) {}

  async getRunningQueries() {
    const sql = `
      SELECT 
        pid,
        user_name,
        starttime,
        query,
        substring(query, 1, 100) as query_snippet
      FROM stv_recents
      WHERE status = 'Running'
      ORDER BY starttime DESC
    `;

    return this.redshiftService.query({
      database: process.env.REDSHIFT_DATABASE!,
      workgroupName: process.env.REDSHIFT_WORKGROUP!
    }, sql);
  }

  async getSlowQueries(durationThresholdSeconds: number = 300) {
    const sql = `
      SELECT 
        query,
        userid,
        starttime,
        endtime,
        datediff(seconds, starttime, endtime) as duration_seconds,
        substring(querytxt, 1, 200) as query_text
      FROM stl_query
      WHERE datediff(seconds, starttime, endtime) > ${durationThresholdSeconds}
        AND starttime > current_date - 1
      ORDER BY duration_seconds DESC
      LIMIT 50
    `;

    return this.redshiftService.query({
      database: process.env.REDSHIFT_DATABASE!,
      workgroupName: process.env.REDSHIFT_WORKGROUP!
    }, sql);
  }

  async getTableStats() {
    const sql = `
      SELECT 
        schemaname,
        tablename,
        size as size_mb,
        tbl_rows,
        skew_sortkey1,
        skew_rows
      FROM svv_table_info
      WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
      ORDER BY size DESC
    `;

    return this.redshiftService.query({
      database: process.env.REDSHIFT_DATABASE!,
      workgroupName: process.env.REDSHIFT_WORKGROUP!
    }, sql);
  }

  async analyzeQueryPerformance(queryId: string) {
    const sql = `
      SELECT 
        step,
        max_time,
        avg_time,
        rows,
        bytes,
        label
      FROM stl_explain
      WHERE query = ${queryId}
      ORDER BY step
    `;

    return this.redshiftService.query({
      database: process.env.REDSHIFT_DATABASE!,
      workgroupName: process.env.REDSHIFT_WORKGROUP!
    }, sql);
  }
}
```

## Advanced Usage

### Query Result Caching

```typescript
@Injectable()
export class CachedRedshiftService {
  private queryCache = new Map<string, { result: any; timestamp: number }>();
  private readonly CACHE_TTL = 300000; // 5 minutes

  constructor(private redshiftService: RedshiftDataService) {}

  async queryCached(queryParams: any, sql: string, cacheTTL?: number) {
    const cacheKey = this.generateCacheKey(queryParams, sql);
    const cached = this.queryCache.get(cacheKey);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < (cacheTTL || this.CACHE_TTL)) {
      console.log('Returning cached query result');
      return cached.result;
    }

    console.log('Executing fresh query');
    const result = await this.redshiftService.query(queryParams, sql);
    
    this.queryCache.set(cacheKey, {
      result,
      timestamp: now
    });

    return result;
  }

  private generateCacheKey(queryParams: any, sql: string): string {
    return Buffer.from(`${JSON.stringify(queryParams)}-${sql}`).toString('base64');
  }

  clearCache() {
    this.queryCache.clear();
  }
}
```

### Batch Query Executor

```typescript
@Injectable()
export class BatchQueryService {
  constructor(private redshiftService: RedshiftDataService) {}

  async executeBatch(queries: Array<{ id: string; sql: string }>) {
    const queryParams = {
      database: process.env.REDSHIFT_DATABASE!,
      workgroupName: process.env.REDSHIFT_WORKGROUP!
    };

    const results = [];
    
    for (const query of queries) {
      try {
        console.log(`Executing query ${query.id}`);
        const result = await this.redshiftService.query(queryParams, query.sql);
        results.push({
          id: query.id,
          success: true,
          result,
          rowCount: result.length
        });
      } catch (error) {
        console.error(`Query ${query.id} failed:`, error);
        results.push({
          id: query.id,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  async executeTransaction(queries: string[]) {
    const queryParams = {
      database: process.env.REDSHIFT_DATABASE!,
      workgroupName: process.env.REDSHIFT_WORKGROUP!
    };

    try {
      await this.redshiftService.query(queryParams, 'BEGIN');
      
      const results = [];
      for (const sql of queries) {
        const result = await this.redshiftService.query(queryParams, sql);
        results.push(result);
      }
      
      await this.redshiftService.query(queryParams, 'COMMIT');
      return results;
    } catch (error) {
      await this.redshiftService.query(queryParams, 'ROLLBACK');
      throw error;
    }
  }
}
```

## Best Practices

### 1. Query Optimization

```typescript
// Use LIMIT for testing
const testQuery = `SELECT * FROM large_table LIMIT 100`;

// Use column names instead of SELECT *
const optimizedQuery = `SELECT id, name, created_at FROM users WHERE active = true`;

// Use proper data types
const efficientQuery = `
  SELECT date_trunc('day', event_date) as day, count(*)
  FROM events
  WHERE event_date >= current_date - interval '7 days'
  GROUP BY 1
`;
```

### 2. Error Handling

```typescript
async safeQuery(queryParams: any, sql: string): Promise<any[]> {
  try {
    return await this.redshiftService.query(queryParams, sql);
  } catch (error: any) {
    console.error('Redshift query failed:', error);
    
    if (error.message.includes('permission denied')) {
      throw new Error('Insufficient permissions for this query');
    } else if (error.message.includes('relation does not exist')) {
      throw new Error('Table or view not found');
    }
    
    throw error;
  }
}
```

### 3. Connection Management

```typescript
async ensureConnection(): Promise<void> {
  try {
    await this.redshiftService.verifyEndpointAccess(process.env.REDSHIFT_WORKGROUP!);
  } catch (error) {
    throw new Error('Cannot connect to Redshift cluster');
  }
}
```

## Testing

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ServerAwsRedshiftModule, RedshiftDataService } from '@onivoro/server-aws-redshift';

describe('RedshiftDataService', () => {
  let service: RedshiftDataService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ServerAwsRedshiftModule.configure({
        AWS_REGION: 'us-east-1',
        REDSHIFT_DATABASE: 'test',
        REDSHIFT_WORKGROUP: 'test-workgroup',
        AWS_PROFILE: 'test'
      })],
    }).compile();

    service = module.get<RedshiftDataService>(RedshiftDataService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should execute simple query', async () => {
    const result = await service.query({
      database: 'test',
      workgroupName: 'test-workgroup'
    }, 'SELECT 1 as test_value');
    
    expect(result).toBeDefined();
  });
});
```

## API Reference

### Exported Classes
- `ServerAwsRedshiftConfig`: Configuration class for Redshift settings
- `ServerAwsRedshiftModule`: NestJS module for Redshift integration

### Exported Services
- `RedshiftDataService`: Main Redshift service with query execution and user management capabilities

## License

This library is licensed under the MIT License. See the LICENSE file in this package for details.