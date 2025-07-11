# @onivoro/server-aws-ecs

A NestJS module for integrating with AWS ECS (Elastic Container Service), providing task execution, container management, and deployment orchestration capabilities for your server applications.

## Installation

```bash
npm install @onivoro/server-aws-ecs
```

## Features

- **Task Execution**: Run ECS tasks with Fargate launch type
- **Network Configuration**: Configure VPC, subnets, and security groups
- **Environment Variable Mapping**: Convert objects to ECS environment variable format
- **Batch Task Running**: Execute multiple tasks concurrently
- **Task Overrides**: Dynamic container and task definition overrides
- **CSV String Parsing**: Utility for parsing comma-separated configuration values
- **Error Handling**: Comprehensive error handling for ECS operations

## Quick Start

### 1. Module Configuration

```typescript
import { ServerAwsEcsModule } from '@onivoro/server-aws-ecs';

@Module({
  imports: [
    ServerAwsEcsModule.configure({
      AWS_REGION: 'us-east-1',
      CLUSTER_NAME: process.env.ECS_CLUSTER_NAME,
      TASK_DEFINITION: process.env.ECS_TASK_DEFINITION,
      SUBNETS: process.env.ECS_SUBNETS,
      SECURITY_GROUPS: process.env.ECS_SECURITY_GROUPS,
      AWS_PROFILE: process.env.AWS_PROFILE || 'default',
    }),
  ],
})
export class AppModule {}
```

### 2. Basic Usage

```typescript
import { EcsService } from '@onivoro/server-aws-ecs';

@Injectable()
export class TaskRunnerService {
  constructor(private ecsService: EcsService) {}

  async runDataProcessingTask(jobData: any) {
    const taskParams = {
      taskDefinition: 'data-processor:1',
      cluster: 'my-cluster',
      subnets: 'subnet-12345,subnet-67890',
      securityGroups: 'sg-12345',
      taskCount: 1,
      overrides: {
        containerOverrides: [{
          name: 'data-processor',
          environment: EcsService.mapObjectToEcsEnvironmentArray({
            JOB_ID: jobData.id,
            JOB_TYPE: jobData.type,
            DATA_SOURCE: jobData.source
          })
        }]
      }
    };

    return this.ecsService.runTasks(taskParams);
  }
}
```

## Configuration

### ServerAwsEcsConfig

```typescript
import { ServerAwsEcsConfig } from '@onivoro/server-aws-ecs';

export class AppEcsConfig extends ServerAwsEcsConfig {
  AWS_REGION = process.env.AWS_REGION || 'us-east-1';
  CLUSTER_NAME = process.env.ECS_CLUSTER_NAME || 'default-cluster';
  TASK_DEFINITION = process.env.ECS_TASK_DEFINITION || 'my-task-definition';
  SUBNETS = process.env.ECS_SUBNETS || 'subnet-12345,subnet-67890';
  SECURITY_GROUPS = process.env.ECS_SECURITY_GROUPS || 'sg-12345';
  AWS_PROFILE = process.env.AWS_PROFILE || 'default';
  ASSIGN_PUBLIC_IP = process.env.ECS_ASSIGN_PUBLIC_IP === 'true' ? 'ENABLED' : 'DISABLED';
}
```

### Environment Variables

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_PROFILE=default

# ECS Configuration
ECS_CLUSTER_NAME=my-application-cluster
ECS_TASK_DEFINITION=my-task-definition:1
ECS_SUBNETS=subnet-12345,subnet-67890,subnet-abcde
ECS_SECURITY_GROUPS=sg-12345,sg-67890
ECS_ASSIGN_PUBLIC_IP=false
```

## Services

### EcsService

The main service for ECS operations:

```typescript
import { EcsService } from '@onivoro/server-aws-ecs';

@Injectable()
export class BatchProcessingService {
  constructor(private ecsService: EcsService) {}

  async runBatchJob(jobConfig: BatchJobConfig) {
    const environmentVars = EcsService.mapObjectToEcsEnvironmentArray({
      BATCH_ID: jobConfig.batchId,
      INPUT_BUCKET: jobConfig.inputBucket,
      OUTPUT_BUCKET: jobConfig.outputBucket,
      PROCESSING_MODE: jobConfig.mode,
      WORKER_COUNT: jobConfig.workerCount.toString()
    });

    return this.ecsService.runTasks({
      taskDefinition: jobConfig.taskDefinition,
      cluster: jobConfig.cluster,
      subnets: jobConfig.subnets,
      securityGroups: jobConfig.securityGroups,
      taskCount: jobConfig.taskCount,
      overrides: {
        containerOverrides: [{
          name: jobConfig.containerName,
          environment: environmentVars,
          memory: jobConfig.memoryReservation,
          cpu: jobConfig.cpuReservation
        }]
      }
    });
  }
}
```

## Usage Examples

### Data Processing Pipeline

```typescript
import { EcsService } from '@onivoro/server-aws-ecs';

@Injectable()
export class DataPipelineService {
  constructor(private ecsService: EcsService) {}

  async processDataset(dataset: DatasetConfig) {
    // Step 1: Data validation task
    const validationTasks = await this.runValidationTasks(dataset);
    console.log(`Started ${validationTasks.length} validation tasks`);

    // Step 2: Data transformation tasks (run in parallel)
    const transformationTasks = await this.runTransformationTasks(dataset);
    console.log(`Started ${transformationTasks.length} transformation tasks`);

    // Step 3: Data aggregation task
    const aggregationTasks = await this.runAggregationTasks(dataset);
    console.log(`Started ${aggregationTasks.length} aggregation tasks`);

    return {
      validationTasks: validationTasks.length,
      transformationTasks: transformationTasks.length,
      aggregationTasks: aggregationTasks.length
    };
  }

  private async runValidationTasks(dataset: DatasetConfig) {
    return this.ecsService.runTasks({
      taskDefinition: 'data-validator:1',
      cluster: 'data-processing-cluster',
      subnets: process.env.ECS_SUBNETS!,
      securityGroups: process.env.ECS_SECURITY_GROUPS!,
      taskCount: 1,
      overrides: {
        containerOverrides: [{
          name: 'validator',
          environment: EcsService.mapObjectToEcsEnvironmentArray({
            DATASET_ID: dataset.id,
            VALIDATION_RULES: JSON.stringify(dataset.validationRules),
            INPUT_LOCATION: dataset.inputLocation,
            VALIDATION_OUTPUT: dataset.validationOutput
          })
        }]
      }
    });
  }

  private async runTransformationTasks(dataset: DatasetConfig) {
    const taskCount = Math.ceil(dataset.size / dataset.chunkSize);
    
    return this.ecsService.runTasks({
      taskDefinition: 'data-transformer:1',
      cluster: 'data-processing-cluster',
      subnets: process.env.ECS_SUBNETS!,
      securityGroups: process.env.ECS_SECURITY_GROUPS!,
      taskCount,
      overrides: {
        containerOverrides: [{
          name: 'transformer',
          environment: EcsService.mapObjectToEcsEnvironmentArray({
            DATASET_ID: dataset.id,
            CHUNK_SIZE: dataset.chunkSize.toString(),
            TRANSFORMATION_CONFIG: JSON.stringify(dataset.transformationConfig),
            INPUT_LOCATION: dataset.inputLocation,
            OUTPUT_LOCATION: dataset.outputLocation
          }),
          memory: 2048,
          cpu: 1024
        }]
      }
    });
  }

  private async runAggregationTasks(dataset: DatasetConfig) {
    return this.ecsService.runTasks({
      taskDefinition: 'data-aggregator:1',
      cluster: 'data-processing-cluster',
      subnets: process.env.ECS_SUBNETS!,
      securityGroups: process.env.ECS_SECURITY_GROUPS!,
      taskCount: 1,
      overrides: {
        containerOverrides: [{
          name: 'aggregator',
          environment: EcsService.mapObjectToEcsEnvironmentArray({
            DATASET_ID: dataset.id,
            AGGREGATION_RULES: JSON.stringify(dataset.aggregationRules),
            INPUT_LOCATION: dataset.outputLocation,
            FINAL_OUTPUT: dataset.finalOutput
          }),
          memory: 4096,
          cpu: 2048
        }]
      }
    });
  }
}
```

### Scheduled Task Runner

```typescript
import { EcsService } from '@onivoro/server-aws-ecs';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class ScheduledTaskService {
  constructor(private ecsService: EcsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async runHourlyReports() {
    console.log('Starting hourly report generation...');
    
    const reportTasks = await this.ecsService.runTasks({
      taskDefinition: 'report-generator:1',
      cluster: 'reporting-cluster',
      subnets: process.env.ECS_SUBNETS!,
      securityGroups: process.env.ECS_SECURITY_GROUPS!,
      taskCount: 1,
      overrides: {
        containerOverrides: [{
          name: 'report-generator',
          environment: EcsService.mapObjectToEcsEnvironmentArray({
            REPORT_TYPE: 'HOURLY',
            REPORT_TIME: new Date().toISOString(),
            OUTPUT_BUCKET: 'my-reports-bucket',
            NOTIFICATION_TOPIC: 'arn:aws:sns:us-east-1:123456789012:reports'
          })
        }]
      }
    });

    console.log(`Started ${reportTasks.length} report generation tasks`);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async runDailyMaintenance() {
    console.log('Starting daily maintenance tasks...');
    
    // Run multiple maintenance tasks in parallel
    const maintenanceTasks = [
      this.runDataCleanupTask(),
      this.runBackupTask(),
      this.runHealthCheckTask()
    ];

    const results = await Promise.allSettled(maintenanceTasks);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        console.log(`Maintenance task ${index + 1} completed successfully`);
      } else {
        console.error(`Maintenance task ${index + 1} failed:`, result.reason);
      }
    });
  }

  private async runDataCleanupTask() {
    return this.ecsService.runTasks({
      taskDefinition: 'data-cleanup:1',
      cluster: 'maintenance-cluster',
      subnets: process.env.ECS_SUBNETS!,
      securityGroups: process.env.ECS_SECURITY_GROUPS!,
      taskCount: 1,
      overrides: {
        containerOverrides: [{
          name: 'cleanup',
          environment: EcsService.mapObjectToEcsEnvironmentArray({
            CLEANUP_MODE: 'DAILY',
            RETENTION_DAYS: '30',
            TARGET_TABLES: 'logs,temp_data,session_data'
          })
        }]
      }
    });
  }

  private async runBackupTask() {
    return this.ecsService.runTasks({
      taskDefinition: 'backup-service:1',
      cluster: 'maintenance-cluster',
      subnets: process.env.ECS_SUBNETS!,
      securityGroups: process.env.ECS_SECURITY_GROUPS!,
      taskCount: 1,
      overrides: {
        containerOverrides: [{
          name: 'backup',
          environment: EcsService.mapObjectToEcsEnvironmentArray({
            BACKUP_TYPE: 'DAILY',
            BACKUP_TARGET: 's3://my-backup-bucket',
            DATABASE_URL: process.env.DATABASE_URL!
          })
        }]
      }
    });
  }

  private async runHealthCheckTask() {
    return this.ecsService.runTasks({
      taskDefinition: 'health-checker:1',
      cluster: 'maintenance-cluster',
      subnets: process.env.ECS_SUBNETS!,
      securityGroups: process.env.ECS_SECURITY_GROUPS!,
      taskCount: 1,
      overrides: {
        containerOverrides: [{
          name: 'health-checker',
          environment: EcsService.mapObjectToEcsEnvironmentArray({
            CHECK_TYPE: 'COMPREHENSIVE',
            NOTIFICATION_WEBHOOK: process.env.HEALTH_WEBHOOK_URL!,
            SERVICES_TO_CHECK: 'api,database,cache,storage'
          })
        }]
      }
    });
  }
}
```

### Dynamic Task Configuration

```typescript
import { EcsService } from '@onivoro/server-aws-ecs';

@Injectable()
export class DynamicTaskService {
  constructor(private ecsService: EcsService) {}

  async runCustomTask(taskConfig: CustomTaskConfig) {
    // Validate task configuration
    this.validateTaskConfig(taskConfig);

    // Build environment variables dynamically
    const environment = EcsService.mapObjectToEcsEnvironmentArray({
      ...taskConfig.environmentVariables,
      TASK_ID: this.generateTaskId(),
      STARTED_AT: new Date().toISOString(),
      CONFIGURATION: JSON.stringify(taskConfig.configuration)
    });

    // Configure resource requirements based on task type
    const resourceConfig = this.getResourceConfiguration(taskConfig.taskType);

    return this.ecsService.runTasks({
      taskDefinition: taskConfig.taskDefinition,
      cluster: taskConfig.cluster || 'default-cluster',
      subnets: taskConfig.subnets || process.env.ECS_SUBNETS!,
      securityGroups: taskConfig.securityGroups || process.env.ECS_SECURITY_GROUPS!,
      taskCount: taskConfig.taskCount || 1,
      overrides: {
        containerOverrides: [{
          name: taskConfig.containerName,
          environment,
          memory: resourceConfig.memory,
          cpu: resourceConfig.cpu,
          ...(taskConfig.command && { command: taskConfig.command })
        }],
        ...(taskConfig.taskRoleArn && {
          taskRoleArn: taskConfig.taskRoleArn
        })
      }
    });
  }

  private validateTaskConfig(config: CustomTaskConfig) {
    if (!config.taskDefinition) {
      throw new Error('Task definition is required');
    }
    if (!config.containerName) {
      throw new Error('Container name is required');
    }
    if (config.taskCount && (config.taskCount < 1 || config.taskCount > 100)) {
      throw new Error('Task count must be between 1 and 100');
    }
  }

  private generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getResourceConfiguration(taskType: string) {
    const configurations = {
      'cpu-intensive': { memory: 4096, cpu: 2048 },
      'memory-intensive': { memory: 8192, cpu: 1024 },
      'balanced': { memory: 2048, cpu: 1024 },
      'lightweight': { memory: 512, cpu: 256 }
    };

    return configurations[taskType] || configurations['balanced'];
  }
}
```

## Advanced Usage

### Task Monitoring and Logging

```typescript
import { ECS, DescribeTasksCommand } from '@aws-sdk/client-ecs';

@Injectable()
export class EcsTaskMonitoringService {
  constructor(
    private ecsService: EcsService,
    private ecsClient: ECS
  ) {}

  async runTaskWithMonitoring(taskParams: any, monitoringOptions?: TaskMonitoringOptions) {
    // Start the task
    const taskResults = await this.ecsService.runTasks(taskParams);
    
    if (!taskResults.length || !taskResults[0].tasks?.length) {
      throw new Error('Failed to start tasks');
    }

    const taskArns = taskResults[0].tasks.map(task => task.taskArn!);
    
    // Monitor tasks if monitoring is enabled
    if (monitoringOptions?.monitor) {
      this.monitorTasks(taskArns, taskParams.cluster, monitoringOptions);
    }

    return taskResults;
  }

  private async monitorTasks(taskArns: string[], cluster: string, options: TaskMonitoringOptions) {
    const checkInterval = options.checkInterval || 30000; // 30 seconds
    const timeout = options.timeout || 3600000; // 1 hour
    const startTime = Date.now();

    const monitor = setInterval(async () => {
      try {
        const response = await this.ecsClient.send(new DescribeTasksCommand({
          cluster,
          tasks: taskArns
        }));

        const tasks = response.tasks || [];
        const runningTasks = tasks.filter(task => task.lastStatus === 'RUNNING');
        const stoppedTasks = tasks.filter(task => task.lastStatus === 'STOPPED');

        console.log(`Task Status - Running: ${runningTasks.length}, Stopped: ${stoppedTasks.length}`);

        // Check for failed tasks
        const failedTasks = stoppedTasks.filter(task => task.stopCode !== 'EssentialContainerExited' || task.containers?.some(c => c.exitCode !== 0));
        
        if (failedTasks.length > 0) {
          console.error(`${failedTasks.length} tasks failed:`);
          failedTasks.forEach(task => {
            console.error(`Task ${task.taskArn} failed: ${task.stoppedReason}`);
          });
        }

        // Stop monitoring if all tasks are complete
        if (stoppedTasks.length === taskArns.length) {
          clearInterval(monitor);
          console.log('All tasks completed');
          
          if (options.onComplete) {
            options.onComplete(tasks);
          }
        }

        // Check timeout
        if (Date.now() - startTime > timeout) {
          clearInterval(monitor);
          console.warn('Task monitoring timeout reached');
          
          if (options.onTimeout) {
            options.onTimeout(tasks);
          }
        }
      } catch (error) {
        console.error('Error monitoring tasks:', error);
      }
    }, checkInterval);
  }
}
```

### Utility Functions

The module includes utility functions for common operations:

```typescript
import { EcsService } from '@onivoro/server-aws-ecs';

// Convert object to ECS environment variable format
const envVars = EcsService.mapObjectToEcsEnvironmentArray({
  DATABASE_URL: 'postgresql://localhost:5432/mydb',
  API_KEY: 'secret-key',
  LOG_LEVEL: 'info',
  FEATURE_FLAGS: JSON.stringify({ newFeature: true })
});

console.log(envVars);
// Output: [
//   { Name: 'DATABASE_URL', Value: 'postgresql://localhost:5432/mydb' },
//   { Name: 'API_KEY', Value: 'secret-key' },
//   { Name: 'LOG_LEVEL', Value: 'info' },
//   { Name: 'FEATURE_FLAGS', Value: '{"newFeature":true}' }
// ]
```

### Error Handling and Retry Logic

```typescript
@Injectable()
export class ResilientEcsService {
  constructor(private ecsService: EcsService) {}

  async runTaskWithRetry(taskParams: any, maxRetries: number = 3, backoffMs: number = 1000) {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt}/${maxRetries} to run ECS task`);
        return await this.ecsService.runTasks(taskParams);
      } catch (error: any) {
        lastError = error;
        console.error(`Attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          const delay = backoffMs * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`Waiting ${delay}ms before retry...`);
          await this.delay(delay);
        }
      }
    }

    throw new Error(`Failed to run ECS task after ${maxRetries} attempts. Last error: ${lastError!.message}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Best Practices

### 1. Resource Management

```typescript
// Configure appropriate CPU and memory based on task requirements
const getResourceConfig = (taskType: 'cpu-intensive' | 'memory-intensive' | 'balanced') => {
  switch (taskType) {
    case 'cpu-intensive':
      return { memory: 2048, cpu: 1024 };
    case 'memory-intensive':
      return { memory: 4096, cpu: 512 };
    case 'balanced':
    default:
      return { memory: 1024, cpu: 512 };
  }
};
```

### 2. Environment Variable Security

```typescript
// Use AWS Systems Manager Parameter Store for sensitive data
const secureEnvVars = EcsService.mapObjectToEcsEnvironmentArray({
  DATABASE_URL: '${ssm:/app/database/url}',
  API_KEY: '${ssm-secure:/app/api/key}',
  PUBLIC_CONFIG: 'actual-value'
});
```

### 3. Task Definition Versioning

```typescript
// Always specify task definition versions
const taskDefinition = `${baseTaskDefinition}:${version}`;
```

## Testing

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ServerAwsEcsModule, EcsService } from '@onivoro/server-aws-ecs';

describe('EcsService', () => {
  let service: EcsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ServerAwsEcsModule.configure({
        AWS_REGION: 'us-east-1',
        CLUSTER_NAME: 'test-cluster',
        TASK_DEFINITION: 'test-task:1',
        SUBNETS: 'subnet-12345',
        SECURITY_GROUPS: 'sg-12345',
        AWS_PROFILE: 'test'
      })],
    }).compile();

    service = module.get<EcsService>(EcsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should map object to ECS environment array', () => {
    const envObject = { KEY1: 'value1', KEY2: 'value2' };
    const result = EcsService.mapObjectToEcsEnvironmentArray(envObject);
    
    expect(result).toEqual([
      { Name: 'KEY1', Value: 'value1' },
      { Name: 'KEY2', Value: 'value2' }
    ]);
  });
});
```

## API Reference

### Exported Classes
- `ServerAwsEcsConfig`: Configuration class for ECS settings
- `ServerAwsEcsModule`: NestJS module for ECS integration

### Exported Services
- `EcsService`: Main ECS service with task execution capabilities

### Static Methods
- `EcsService.mapObjectToEcsEnvironmentArray()`: Convert object to ECS environment variable format

## License

This library is licensed under the MIT License. See the LICENSE file in this package for details.