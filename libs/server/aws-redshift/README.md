# @onivoro/server-aws-redshift

AWS Redshift Data API integration for NestJS applications.

## Installation

```bash
npm install @onivoro/server-aws-redshift
```

## Overview

This library provides AWS Redshift Data API integration for NestJS applications, offering basic database operations, user management, and schema permissions.

## Module Setup

```typescript
import { Module } from '@nestjs/common';
import { ServerAwsRedshiftModule } from '@onivoro/server-aws-redshift';

@Module({
  imports: [
    ServerAwsRedshiftModule.configure()
  ]
})
export class AppModule {}
```

## Configuration

The module uses environment-based configuration:

```typescript
export class ServerAwsRedshiftConfig {
  AWS_REGION: string;
  AWS_PROFILE?: string;  // Optional AWS profile
  AWS_REDSHIFT_CLUSTER_IDENTIFIER: string;
  AWS_REDSHIFT_DATABASE: string;
  AWS_REDSHIFT_USER: string;
  AWS_REDSHIFT_WORKGROUP?: string;
  AWS_S3_BUCKET?: string;  // For data operations
}
```

## Service

### RedshiftDataService

The service provides Redshift database operations:

```typescript
import { Injectable } from '@nestjs/common';
import { RedshiftDataService } from '@onivoro/server-aws-redshift';

@Injectable()
export class DataWarehouseService {
  constructor(private readonly redshiftService: RedshiftDataService) {}

  // Execute a query
  async executeQuery(sql: string) {
    const result = await this.redshiftService.query(sql);
    return result;
  }

  // Create a new user
  async createAnalystUser(username: string, password: string) {
    await this.redshiftService.createUser(username, password);
  }

  // Create a user group
  async createAnalystGroup(groupName: string) {
    await this.redshiftService.createGroup(groupName);
  }

  // Add user to group
  async addUserToGroup(username: string, groupName: string) {
    await this.redshiftService.addUserToGroup(username, groupName);
  }

  // Grant schema access
  async grantSchemaAccess(groupName: string, schemaName: string) {
    await this.redshiftService.grantSchemaPermissions(groupName, schemaName);
  }
}
```

## Available Methods

### Query Execution
- **query(sql: string)** - Execute a SQL query and return results

### User Management
- **createUser(username: string, password: string)** - Create a new Redshift user
- **createGroup(groupName: string)** - Create a new user group  
- **addUserToGroup(username: string, groupName: string)** - Add user to a group
- **grantSchemaPermissions(groupName: string, schemaName: string)** - Grant schema access to a group

### Workgroup Operations
- **getWorkgroupEndpoint(workgroupName: string)** - Get the endpoint for a workgroup (used internally)

## Direct Client Access

The service exposes the underlying Redshift Data client:

```typescript
import { 
  ListDatabasesCommand,
  ListTablesCommand,
  DescribeTableCommand,
  GetStatementResultCommand
} from '@aws-sdk/client-redshift-data';

@Injectable()
export class AdvancedRedshiftService {
  constructor(private readonly redshiftService: RedshiftDataService) {}

  // List all databases
  async listDatabases() {
    const command = new ListDatabasesCommand({
      ClusterIdentifier: process.env.AWS_REDSHIFT_CLUSTER_IDENTIFIER,
      Database: process.env.AWS_REDSHIFT_DATABASE,
      DbUser: process.env.AWS_REDSHIFT_USER
    });
    
    return await this.redshiftService.redshiftDataApiClient.send(command);
  }

  // List tables in a schema
  async listTables(schemaName: string) {
    const command = new ListTablesCommand({
      ClusterIdentifier: process.env.AWS_REDSHIFT_CLUSTER_IDENTIFIER,
      Database: process.env.AWS_REDSHIFT_DATABASE,
      DbUser: process.env.AWS_REDSHIFT_USER,
      SchemaPattern: schemaName
    });
    
    return await this.redshiftService.redshiftDataApiClient.send(command);
  }
}
```

## Example: Data Warehouse Operations

```typescript
import { Module, Injectable } from '@nestjs/common';
import { ServerAwsRedshiftModule, RedshiftDataService } from '@onivoro/server-aws-redshift';

@Module({
  imports: [ServerAwsRedshiftModule.configure()],
  providers: [AnalyticsService]
})
export class AnalyticsModule {}

@Injectable()
export class AnalyticsService {
  constructor(private readonly redshiftService: RedshiftDataService) {}

  async setupAnalyticsUser(email: string) {
    const username = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_');
    const tempPassword = `Temp123!${Math.random().toString(36).slice(-4)}`;
    
    try {
      // Create user
      await this.redshiftService.createUser(username, tempPassword);
      
      // Create or use existing analyst group
      const groupName = 'analysts';
      await this.redshiftService.createGroup(groupName);
      
      // Add user to group
      await this.redshiftService.addUserToGroup(username, groupName);
      
      // Grant permissions to analytics schema
      await this.redshiftService.grantSchemaPermissions(groupName, 'analytics');
      
      return {
        username,
        tempPassword,
        message: 'User created successfully. Please change password on first login.'
      };
    } catch (error) {
      console.error('Failed to setup user:', error);
      throw error;
    }
  }

  async runAnalyticsQuery(query: string) {
    // Validate query is read-only
    if (query.toLowerCase().includes('drop') || 
        query.toLowerCase().includes('delete') || 
        query.toLowerCase().includes('update')) {
      throw new Error('Only SELECT queries are allowed');
    }
    
    return await this.redshiftService.query(query);
  }
}
```

## Environment Variables

```bash
# Required
AWS_REGION=us-east-1
AWS_REDSHIFT_CLUSTER_IDENTIFIER=my-redshift-cluster
AWS_REDSHIFT_DATABASE=mydb
AWS_REDSHIFT_USER=admin

# Optional
AWS_PROFILE=my-profile
AWS_REDSHIFT_WORKGROUP=my-workgroup
AWS_S3_BUCKET=my-data-bucket
```

## Limitations

- Basic query execution only (no advanced features like prepared statements)
- Limited user management capabilities
- No built-in connection pooling or query optimization
- No support for advanced Redshift features (materialized views, stored procedures)
- For advanced operations, use the exposed `redshiftDataApiClient` directly

## Best Practices

1. **Security**: Use least-privilege database users
2. **Query Validation**: Always validate user input before executing queries
3. **Error Handling**: Implement proper error handling for database operations
4. **Performance**: Use appropriate cluster sizing and distribution keys
5. **Monitoring**: Monitor query performance using Redshift console

## License

MIT