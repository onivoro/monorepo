# @onivoro/server-aws-ecs

AWS ECS integration for NestJS applications with task execution capabilities.

## Installation

```bash
npm install @onivoro/server-aws-ecs
```

## Overview

This library provides a simple ECS (Elastic Container Service) integration for NestJS applications, allowing you to run ECS tasks programmatically.

## Module Setup

```typescript
import { Module } from '@nestjs/common';
import { ServerAwsEcsModule } from '@onivoro/server-aws-ecs';

@Module({
  imports: [
    ServerAwsEcsModule.configure()
  ]
})
export class AppModule {}
```

## Configuration

The module uses environment-based configuration:

```typescript
export class ServerAwsEcsConfig {
  AWS_REGION: string;
  AWS_PROFILE?: string;  // Optional AWS profile
}
```

## Service

### EcsService

The main service for running ECS tasks.

```typescript
import { Injectable } from '@nestjs/common';
import { EcsService } from '@onivoro/server-aws-ecs';
import { RunTaskCommandInput } from '@aws-sdk/client-ecs';

@Injectable()
export class TaskRunnerService {
  constructor(private readonly ecsService: EcsService) {}

  async runDataProcessingTask() {
    const params: RunTaskCommandInput = {
      cluster: 'my-cluster',
      taskDefinition: 'my-task-definition:1',
      launchType: 'FARGATE',
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: ['subnet-12345'],
          securityGroups: ['sg-12345'],
          assignPublicIp: 'ENABLED'
        }
      },
      overrides: {
        containerOverrides: [{
          name: 'my-container',
          environment: [
            { name: 'ENV_VAR', value: 'value' }
          ]
        }]
      }
    };

    const result = await this.ecsService.runTasks(params);
    return result;
  }
}
```

## Utility Function

### mapObjectToEcsEnvironmentArray

A static utility function to convert a plain object to ECS environment variable format:

```typescript
import { EcsService } from '@onivoro/server-aws-ecs';

const envVars = {
  NODE_ENV: 'production',
  API_KEY: 'secret-key',
  PORT: '3000'
};

const ecsEnvironment = EcsService.mapObjectToEcsEnvironmentArray(envVars);
// Returns:
// [
//   { name: 'NODE_ENV', value: 'production' },
//   { name: 'API_KEY', value: 'secret-key' },
//   { name: 'PORT', value: '3000' }
// ]

// Use in task configuration
const taskParams: RunTaskCommandInput = {
  cluster: 'my-cluster',
  taskDefinition: 'my-task',
  overrides: {
    containerOverrides: [{
      name: 'container',
      environment: ecsEnvironment
    }]
  }
};
```

## Direct Client Access

The service exposes the underlying ECS client for advanced operations:

```typescript
@Injectable()
export class AdvancedEcsService {
  constructor(private readonly ecsService: EcsService) {}

  async describeCluster(clusterName: string) {
    const command = new DescribeClustersCommand({
      clusters: [clusterName]
    });
    
    return await this.ecsService.ecsClient.send(command);
  }

  async listTasks(cluster: string) {
    const command = new ListTasksCommand({
      cluster,
      desiredStatus: 'RUNNING'
    });
    
    return await this.ecsService.ecsClient.send(command);
  }
}
```

## Complete Example

```typescript
import { Module, Injectable } from '@nestjs/common';
import { ServerAwsEcsModule, EcsService } from '@onivoro/server-aws-ecs';
import { RunTaskCommandInput } from '@aws-sdk/client-ecs';

@Module({
  imports: [ServerAwsEcsModule.configure()],
  providers: [BatchProcessorService],
  exports: [BatchProcessorService]
})
export class BatchModule {}

@Injectable()
export class BatchProcessorService {
  constructor(private readonly ecsService: EcsService) {}

  async processBatch(batchId: string, items: string[]) {
    // Convert environment variables
    const environment = EcsService.mapObjectToEcsEnvironmentArray({
      BATCH_ID: batchId,
      ITEMS: items.join(','),
      PROCESS_DATE: new Date().toISOString()
    });

    // Configure task
    const params: RunTaskCommandInput = {
      cluster: 'batch-processing-cluster',
      taskDefinition: 'batch-processor:latest',
      launchType: 'FARGATE',
      count: 1,
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: [process.env.SUBNET_ID],
          securityGroups: [process.env.SECURITY_GROUP_ID],
          assignPublicIp: 'ENABLED'
        }
      },
      overrides: {
        containerOverrides: [{
          name: 'processor',
          environment
        }]
      }
    };

    // Run task
    const result = await this.ecsService.runTasks(params);
    
    if (result.failures && result.failures.length > 0) {
      throw new Error(`Failed to start task: ${result.failures[0].reason}`);
    }

    return result.tasks?.[0]?.taskArn;
  }
}
```

## Environment Variables

Configure the module using these environment variables:

```bash
# Required: AWS region
AWS_REGION=us-east-1

# Optional: AWS profile
AWS_PROFILE=my-profile
```

## AWS Credentials

The module uses the standard AWS SDK credential chain:
1. Environment variables
2. Shared credentials file
3. IAM roles (for EC2/ECS/Lambda)

## Limitations

- This is a thin wrapper around the AWS ECS SDK
- Only provides the `runTasks` method for task execution
- For more advanced ECS operations, use the exposed `ecsClient` directly

## License

MIT