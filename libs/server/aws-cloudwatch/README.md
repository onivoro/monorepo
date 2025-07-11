# @onivoro/server-aws-cloudwatch

A NestJS module for integrating with AWS CloudWatch and CloudWatch Logs services, providing structured logging, metrics collection, and log management capabilities for your server applications.

## Installation

```bash
npm install @onivoro/server-aws-cloudwatch
```

## Features

- **CloudWatch Integration**: Direct integration with AWS CloudWatch services
- **CloudWatch Logs**: Stream logs to AWS CloudWatch Logs
- **Structured Logging**: Support for structured log data
- **Configurable Log Groups**: Flexible log group and stream management
- **Metrics Collection**: CloudWatch metrics and custom metrics support
- **Auto-Configuration**: Environment-based configuration with sensible defaults

## Quick Start

### 1. Module Configuration

```typescript
import { ServerAwsCloudwatchModule } from '@onivoro/server-aws-cloudwatch';

@Module({
  imports: [
    ServerAwsCloudwatchModule.forRoot({
      region: 'us-east-1',
      logGroupName: '/aws/lambda/my-app',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }),
  ],
})
export class AppModule {}
```

### 2. Basic Usage

```typescript
import { CloudwatchService, CloudwatchLogsService } from '@onivoro/server-aws-cloudwatch';

@Injectable()
export class LoggingService {
  constructor(
    private cloudwatchService: CloudwatchService,
    private cloudwatchLogsService: CloudwatchLogsService
  ) {}

  async logMessage(message: string, metadata?: any) {
    await this.cloudwatchLogsService.putLogEvents([{
      message,
      timestamp: Date.now(),
      metadata
    }]);
  }

  async putMetric(metricName: string, value: number, unit: string = 'Count') {
    await this.cloudwatchService.putMetricData({
      Namespace: 'MyApp',
      MetricData: [{
        MetricName: metricName,
        Value: value,
        Unit: unit,
        Timestamp: new Date()
      }]
    });
  }
}
```

## Configuration

### ServerAwsCloudwatchConfig

```typescript
import { ServerAwsCloudwatchConfig } from '@onivoro/server-aws-cloudwatch';

export class AppCloudwatchConfig extends ServerAwsCloudwatchConfig {
  region = process.env.AWS_REGION || 'us-east-1';
  accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  logGroupName = process.env.CLOUDWATCH_LOG_GROUP || '/aws/lambda/default';
  logStreamName = process.env.CLOUDWATCH_LOG_STREAM || 'default-stream';
  retentionInDays = parseInt(process.env.LOG_RETENTION_DAYS) || 14;
}
```

### Environment Variables

```bash
# AWS Credentials
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key

# CloudWatch Configuration
CLOUDWATCH_LOG_GROUP=/aws/lambda/my-app
CLOUDWATCH_LOG_STREAM=my-stream
LOG_RETENTION_DAYS=30
```

## Services

### CloudwatchService

The main service for interacting with CloudWatch metrics:

```typescript
import { CloudwatchService } from '@onivoro/server-aws-cloudwatch';

@Injectable()
export class MetricsService {
  constructor(private cloudwatchService: CloudwatchService) {}

  async recordCustomMetric(name: string, value: number, dimensions?: any[]) {
    await this.cloudwatchService.putMetricData({
      Namespace: 'MyApplication',
      MetricData: [{
        MetricName: name,
        Value: value,
        Unit: 'Count',
        Dimensions: dimensions,
        Timestamp: new Date()
      }]
    });
  }

  async getMetricStatistics(metricName: string, startTime: Date, endTime: Date) {
    return this.cloudwatchService.getMetricStatistics({
      Namespace: 'MyApplication',
      MetricName: metricName,
      StartTime: startTime,
      EndTime: endTime,
      Period: 300, // 5 minutes
      Statistics: ['Average', 'Sum', 'Maximum', 'Minimum']
    });
  }

  async createAlarm(alarmName: string, metricName: string, threshold: number) {
    await this.cloudwatchService.putMetricAlarm({
      AlarmName: alarmName,
      ComparisonOperator: 'GreaterThanThreshold',
      EvaluationPeriods: 2,
      MetricName: metricName,
      Namespace: 'MyApplication',
      Period: 300,
      Statistic: 'Average',
      Threshold: threshold,
      ActionsEnabled: true,
      AlarmDescription: `Alarm for ${metricName}`,
      Unit: 'Count'
    });
  }
}
```

### CloudwatchLogsService

Service for managing CloudWatch Logs:

```typescript
import { CloudwatchLogsService } from '@onivoro/server-aws-cloudwatch';

@Injectable()
export class ApplicationLogsService {
  constructor(private logsService: CloudwatchLogsService) {}

  async logError(error: Error, context?: string) {
    await this.logsService.putLogEvents([{
      message: JSON.stringify({
        level: 'error',
        message: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString()
      }),
      timestamp: Date.now()
    }]);
  }

  async logInfo(message: string, data?: any) {
    await this.logsService.putLogEvents([{
      message: JSON.stringify({
        level: 'info',
        message,
        data,
        timestamp: new Date().toISOString()
      }),
      timestamp: Date.now()
    }]);
  }

  async logWarning(message: string, details?: any) {
    await this.logsService.putLogEvents([{
      message: JSON.stringify({
        level: 'warning',
        message,
        details,
        timestamp: new Date().toISOString()
      }),
      timestamp: Date.now()
    }]);
  }

  async createLogGroup(logGroupName: string, retentionInDays?: number) {
    await this.logsService.createLogGroup({
      logGroupName,
      ...(retentionInDays && { retentionInDays })
    });
  }

  async createLogStream(logGroupName: string, logStreamName: string) {
    await this.logsService.createLogStream({
      logGroupName,
      logStreamName
    });
  }

  async getLogEvents(logGroupName: string, logStreamName: string, startTime?: number, endTime?: number) {
    return this.logsService.getLogEvents({
      logGroupName,
      logStreamName,
      startTime,
      endTime,
      limit: 100
    });
  }
}
```

## Advanced Usage

### Custom Log Formatting

```typescript
interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
  requestId?: string;
  userId?: string;
  metadata?: any;
}

@Injectable()
export class StructuredLoggingService {
  constructor(private logsService: CloudwatchLogsService) {}

  async log(entry: LogEntry) {
    await this.logsService.putLogEvents([{
      message: JSON.stringify(entry),
      timestamp: Date.now()
    }]);
  }

  async logWithContext(level: LogEntry['level'], message: string, context: any) {
    await this.log({
      level,
      message,
      timestamp: new Date().toISOString(),
      requestId: context.requestId,
      userId: context.userId,
      metadata: context.metadata
    });
  }
}
```

### Batch Log Processing

```typescript
@Injectable()
export class BatchLoggingService {
  private logBuffer: Array<{ message: string; timestamp: number }> = [];
  private readonly bufferSize = 100;
  private flushInterval: NodeJS.Timeout;

  constructor(private logsService: CloudwatchLogsService) {
    // Auto-flush every 30 seconds
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 30000);
  }

  addLog(message: string, data?: any) {
    this.logBuffer.push({
      message: JSON.stringify({ message, data, timestamp: new Date().toISOString() }),
      timestamp: Date.now()
    });

    if (this.logBuffer.length >= this.bufferSize) {
      this.flush();
    }
  }

  async flush() {
    if (this.logBuffer.length === 0) return;

    const logsToSend = [...this.logBuffer];
    this.logBuffer = [];

    try {
      await this.logsService.putLogEvents(logsToSend);
    } catch (error) {
      // Return logs to buffer if send fails
      this.logBuffer.unshift(...logsToSend);
      throw error;
    }
  }

  onModuleDestroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    // Final flush on shutdown
    this.flush();
  }
}
```

### Metrics Dashboard Service

```typescript
@Injectable()
export class MetricsDashboardService {
  constructor(private cloudwatchService: CloudwatchService) {}

  async getApplicationMetrics(timeRange: { start: Date; end: Date }) {
    const metrics = await Promise.all([
      this.getRequestCount(timeRange),
      this.getErrorRate(timeRange),
      this.getResponseTime(timeRange)
    ]);

    return {
      requestCount: metrics[0],
      errorRate: metrics[1],
      responseTime: metrics[2]
    };
  }

  private async getRequestCount(timeRange: { start: Date; end: Date }) {
    return this.cloudwatchService.getMetricStatistics({
      Namespace: 'MyApp',
      MetricName: 'RequestCount',
      StartTime: timeRange.start,
      EndTime: timeRange.end,
      Period: 300,
      Statistics: ['Sum']
    });
  }

  private async getErrorRate(timeRange: { start: Date; end: Date }) {
    return this.cloudwatchService.getMetricStatistics({
      Namespace: 'MyApp',
      MetricName: 'ErrorRate',
      StartTime: timeRange.start,
      EndTime: timeRange.end,
      Period: 300,
      Statistics: ['Average']
    });
  }

  private async getResponseTime(timeRange: { start: Date; end: Date }) {
    return this.cloudwatchService.getMetricStatistics({
      Namespace: 'MyApp',
      MetricName: 'ResponseTime',
      StartTime: timeRange.start,
      EndTime: timeRange.end,
      Period: 300,
      Statistics: ['Average', 'Maximum']
    });
  }
}
```

## Integration with NestJS Logger

```typescript
import { Logger } from '@nestjs/common';
import { CloudwatchLogsService } from '@onivoro/server-aws-cloudwatch';

@Injectable()
export class CloudwatchLogger extends Logger {
  constructor(private logsService: CloudwatchLogsService) {
    super();
  }

  log(message: string, context?: string) {
    super.log(message, context);
    this.logsService.putLogEvents([{
      message: JSON.stringify({ level: 'log', message, context, timestamp: new Date().toISOString() }),
      timestamp: Date.now()
    }]);
  }

  error(message: string, trace?: string, context?: string) {
    super.error(message, trace, context);
    this.logsService.putLogEvents([{
      message: JSON.stringify({ level: 'error', message, trace, context, timestamp: new Date().toISOString() }),
      timestamp: Date.now()
    }]);
  }

  warn(message: string, context?: string) {
    super.warn(message, context);
    this.logsService.putLogEvents([{
      message: JSON.stringify({ level: 'warn', message, context, timestamp: new Date().toISOString() }),
      timestamp: Date.now()
    }]);
  }
}
```

## Best Practices

### 1. Log Structure

Use consistent log structure for better searchability:

```typescript
interface StandardLogEntry {
  timestamp: string;
  level: string;
  message: string;
  requestId?: string;
  userId?: string;
  service: string;
  version: string;
  environment: string;
}
```

### 2. Metric Naming

Follow AWS CloudWatch metric naming conventions:

```typescript
const MetricNames = {
  REQUEST_COUNT: 'RequestCount',
  ERROR_RATE: 'ErrorRate',
  RESPONSE_TIME: 'ResponseTime',
  DATABASE_CONNECTIONS: 'DatabaseConnections'
} as const;
```

### 3. Error Handling

Always handle CloudWatch API errors gracefully:

```typescript
async safeLogToCloudwatch(message: string) {
  try {
    await this.logsService.putLogEvents([{
      message,
      timestamp: Date.now()
    }]);
  } catch (error) {
    // Fall back to local logging
    console.error('Failed to log to CloudWatch:', error);
    console.log('Original message:', message);
  }
}
```

## Testing

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ServerAwsCloudwatchModule, CloudwatchService } from '@onivoro/server-aws-cloudwatch';

describe('CloudwatchService', () => {
  let service: CloudwatchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ServerAwsCloudwatchModule.forRoot({
        region: 'us-east-1',
        logGroupName: '/test/logs'
      })],
    }).compile();

    service = module.get<CloudwatchService>(CloudwatchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

## API Reference

### Exported Classes
- `ServerAwsCloudwatchConfig`: Configuration class for CloudWatch settings
- `ServerAwsCloudwatchModule`: NestJS module for CloudWatch integration

### Exported Services
- `CloudwatchService`: Main CloudWatch metrics service
- `CloudwatchLogsService`: CloudWatch Logs management service

## License

This library is licensed under the MIT License. See the LICENSE file in this package for details.