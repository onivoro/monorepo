# @onivoro/server-aws-ecs

AWS ECS integration for NestJS applications with task execution capabilities.

## Installation

```bash
npm install @onivoro/server-aws-ecs @aws-sdk/client-ecs @nestjs/common
```

`@aws-sdk/client-ecs` and `@nestjs/common` are peer dependencies.

## Overview

This library provides a small ECS (Elastic Container Service) integration for NestJS applications. It launches Fargate tasks programmatically and registers an `ECS` client you can inject for anything else.

## Exports

| Export               | Kind               | Description                                                                |
| -------------------- | ------------------ | -------------------------------------------------------------------------- |
| `ServerAwsEcsModule` | NestJS module      | `configure(config)` registers `ECS`, `ServerAwsEcsConfig` and `EcsService` |
| `ServerAwsEcsConfig` | class              | `{ AWS_REGION: string; AWS_PROFILE?: string }`                             |
| `EcsService`         | injectable service | `runTasks(...)` and the static `mapObjectToEcsEnvironmentArray(...)`       |

## Module Setup

`configure` requires a config object:

```typescript
import { Module } from '@nestjs/common';
import { ServerAwsEcsModule } from '@onivoro/server-aws-ecs';

@Module({
  imports: [
    ServerAwsEcsModule.configure({
      AWS_REGION: process.env.AWS_REGION!,
      AWS_PROFILE: process.env.AWS_PROFILE,
    }),
  ],
})
export class AppModule {}
```

The module imports `ServerAwsCredentialProvidersModule.configure(config)` and exports all of its imports and providers: `ECS` (from `@aws-sdk/client-ecs`), `ServerAwsEcsConfig`, `EcsService`, plus `AwsCredentials`/`ServerAwsCredentialProvidersConfig` through the re-exported credentials module.

The `ECS` client is created with `{ region: config.AWS_REGION, logger: console, credentials }`. It is cached at module scope, so the first `configure()` call in a process decides the client's region and credentials for every later call.

## Configuration

```typescript
export class ServerAwsEcsConfig {
  AWS_PROFILE?: string; // Optional AWS profile
  AWS_REGION: string;
}
```

The module does not read environment variables itself; pass the values in through the config object.

## Service

### EcsService

#### `runTasks(params): Promise<RunTaskCommandOutput[]>`

```typescript
runTasks(params: {
  taskDefinition: string;
  subnets: string;          // comma-separated subnet IDs
  securityGroups: string;   // comma-separated security group IDs
  taskCount: number;        // number of RunTask calls to send
  cluster: string;
  overrides?: TaskOverride; // RunTaskCommandInput['overrides']
}): Promise<RunTaskCommandOutput[]>
```

It sends `taskCount` separate `RunTaskCommand` requests in parallel and resolves with one output per request. Each request uses:

- `launchType: 'FARGATE'`
- `networkConfiguration.awsvpcConfiguration` with `assignPublicIp: 'DISABLED'`, and `subnets`/`securityGroups` parsed from the comma-separated strings (trimmed, empties dropped)
- your `cluster`, `taskDefinition` and `overrides`

If any request fails, the error is logged with `console.error('Failed to run ECS task:', error)` and the returned promise rejects with it. Requests that were already sent are not cancelled.

Launch type, public IP assignment and the per-request `count` cannot be changed through this method. Use the `ECS` client directly for that.

```typescript
import { Injectable } from '@nestjs/common';
import { EcsService } from '@onivoro/server-aws-ecs';

@Injectable()
export class TaskRunnerService {
  constructor(private readonly ecsService: EcsService) {}

  async runDataProcessingTask() {
    const results = await this.ecsService.runTasks({
      cluster: 'my-cluster',
      taskDefinition: 'my-task-definition:1',
      subnets: 'subnet-12345,subnet-67890',
      securityGroups: 'sg-12345',
      taskCount: 2,
      overrides: {
        containerOverrides: [
          {
            name: 'my-container',
            environment: [{ name: 'ENV_VAR', value: 'value' }],
          },
        ],
      },
    });

    return results.flatMap((r) => r.tasks ?? []).map((t) => t.taskArn);
  }
}
```

## Utility Function

### `EcsService.mapObjectToEcsEnvironmentArray(obj)`

A static helper that converts a plain object (or `null`/`undefined`, which gives `[]`) to an array of ECS `KeyValuePair`s, ready for `containerOverrides[].environment`. Values are converted with `String(value)`.

```typescript
import { EcsService } from '@onivoro/server-aws-ecs';

EcsService.mapObjectToEcsEnvironmentArray({ NODE_ENV: 'production', PORT: 3000 });
// Returns:
// [
//   { name: 'NODE_ENV', value: 'production' },
//   { name: 'PORT', value: '3000' }
// ]
```

## Direct Client Access

`EcsService` keeps its client private. For other ECS operations, inject the `ECS` client that the module exports:

```typescript
import { Injectable } from '@nestjs/common';
import { ECS, DescribeClustersCommand, ListTasksCommand } from '@aws-sdk/client-ecs';

@Injectable()
export class AdvancedEcsService {
  constructor(private readonly ecs: ECS) {}

  describeCluster(clusterName: string) {
    return this.ecs.send(new DescribeClustersCommand({ clusters: [clusterName] }));
  }

  listTasks(cluster: string) {
    return this.ecs.send(new ListTasksCommand({ cluster, desiredStatus: 'RUNNING' }));
  }
}
```

## Complete Example

```typescript
import { Module, Injectable } from '@nestjs/common';
import { ServerAwsEcsModule, EcsService } from '@onivoro/server-aws-ecs';

@Injectable()
export class BatchProcessorService {
  constructor(private readonly ecsService: EcsService) {}

  async processBatch(batchId: string, items: string[]) {
    const environment = EcsService.mapObjectToEcsEnvironmentArray({
      BATCH_ID: batchId,
      ITEMS: items.join(','),
      PROCESS_DATE: new Date().toISOString(),
    });

    const [result] = await this.ecsService.runTasks({
      cluster: 'batch-processing-cluster',
      taskDefinition: 'batch-processor',
      subnets: process.env.SUBNET_IDS!,
      securityGroups: process.env.SECURITY_GROUP_IDS!,
      taskCount: 1,
      overrides: {
        containerOverrides: [{ name: 'processor', environment }],
      },
    });

    if (result.failures?.length) {
      throw new Error(`Failed to start task: ${result.failures[0].reason}`);
    }

    return result.tasks?.[0]?.taskArn;
  }
}

@Module({
  imports: [ServerAwsEcsModule.configure({ AWS_REGION: process.env.AWS_REGION! })],
  providers: [BatchProcessorService],
  exports: [BatchProcessorService],
})
export class BatchModule {}
```

## AWS Credentials

Credentials come from [`@onivoro/server-aws-credential-providers`](../aws-credential-providers/):

- When `AWS_PROFILE` is set in the config, the profile is resolved with `fromIni`. If that fails, the module falls back to `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` environment variables.
- When `AWS_PROFILE` is not set, the client gets `credentials: undefined` and uses the AWS SDK default credential chain (environment variables, shared files, IAM roles for EC2/ECS/Lambda, and so on).

## Limitations

- This is a thin wrapper around the AWS ECS SDK.
- `EcsService` only provides `runTasks` (Fargate, no public IP) and the `mapObjectToEcsEnvironmentArray` helper.
- For other ECS operations, inject the exported `ECS` client directly.

## License

MIT
