# @onivoro/server-aws-cloudwatch

AWS CloudWatch integration for NestJS applications, providing services for CloudWatch metrics and CloudWatch Logs operations.

## Installation

```bash
npm install @onivoro/server-aws-cloudwatch
```

## Overview

This library provides NestJS services for interacting with AWS CloudWatch and CloudWatch Logs. It includes:
- **CloudwatchService**: For CloudWatch metrics and dashboards
- **CloudwatchLogsService**: For CloudWatch Logs operations

## Configuration

The module uses environment-based configuration with the following options:

```typescript
export class ServerAwsCloudwatchConfig {
  AWS_PROFILE?: string;  // AWS profile to use (optional)
  AWS_REGION: string;    // AWS region for CloudWatch
}
```

## Usage

### Module Setup

Import and configure the module in your NestJS application:

```typescript
import { ServerAwsCloudwatchModule } from '@onivoro/server-aws-cloudwatch';

@Module({
  imports: [
    ServerAwsCloudwatchModule.configure()
  ]
})
export class AppModule {}
```

### CloudWatch Service

The `CloudwatchService` provides methods for working with CloudWatch metrics and dashboards:

```typescript
import { CloudwatchService } from '@onivoro/server-aws-cloudwatch';
import { 
  PutMetricDataCommand,
  GetMetricStatisticsCommand,
  ListMetricsCommand,
  PutDashboardCommand,
  GetDashboardCommand,
  DeleteDashboardsCommand 
} from '@aws-sdk/client-cloudwatch';

@Injectable()
export class MetricsService {
  constructor(private readonly cloudwatchService: CloudwatchService) {}

  // Put custom metrics
  async recordMetric() {
    const command = new PutMetricDataCommand({
      Namespace: 'MyApp',
      MetricData: [{
        MetricName: 'PageViews',
        Value: 1,
        Timestamp: new Date(),
        Dimensions: [{
          Name: 'PageName',
          Value: 'HomePage'
        }]
      }]
    });
    
    return await this.cloudwatchService.putMetricData(command);
  }

  // Get metric statistics
  async getMetrics() {
    const command = new GetMetricStatisticsCommand({
      Namespace: 'MyApp',
      MetricName: 'PageViews',
      StartTime: new Date(Date.now() - 3600000), // 1 hour ago
      EndTime: new Date(),
      Period: 300, // 5 minutes
      Statistics: ['Average', 'Sum']
    });
    
    return await this.cloudwatchService.getMetricStatistics(command);
  }

  // List available metrics
  async listAvailableMetrics() {
    const command = new ListMetricsCommand({
      Namespace: 'MyApp'
    });
    
    return await this.cloudwatchService.listMetrics(command);
  }

  // Create or update dashboard
  async createDashboard() {
    const command = new PutDashboardCommand({
      DashboardName: 'MyAppDashboard',
      DashboardBody: JSON.stringify({
        widgets: [
          {
            type: 'metric',
            properties: {
              metrics: [['MyApp', 'PageViews']],
              period: 300,
              stat: 'Average',
              region: 'us-east-1',
              title: 'Page Views'
            }
          }
        ]
      })
    });
    
    return await this.cloudwatchService.putDashboard(command);
  }
}
```

### CloudWatch Logs Service

The `CloudwatchLogsService` provides methods for working with CloudWatch Logs:

```typescript
import { CloudwatchLogsService } from '@onivoro/server-aws-cloudwatch';
import {
  FilterLogEventsCommand,
  DescribeLogGroupsCommand,
  DescribeLogStreamsCommand,
  GetLogEventsCommand,
  StartQueryCommand,
  GetQueryResultsCommand,
  StopQueryCommand
} from '@aws-sdk/client-cloudwatch-logs';

@Injectable()
export class LoggingService {
  constructor(private readonly logsService: CloudwatchLogsService) {}

  // Filter log events
  async searchLogs(logGroupName: string, filterPattern?: string) {
    const command = new FilterLogEventsCommand({
      logGroupName,
      filterPattern, // e.g., '[timestamp, request_id, event_type = ERROR*, ...]'
      startTime: Date.now() - 3600000, // 1 hour ago
      endTime: Date.now()
    });
    
    return await this.logsService.filterLogEvents(command);
  }

  // List log groups
  async listLogGroups() {
    const command = new DescribeLogGroupsCommand({
      limit: 50
    });
    
    return await this.logsService.describeLogGroups(command);
  }

  // List log streams in a group
  async listLogStreams(logGroupName: string) {
    const command = new DescribeLogStreamsCommand({
      logGroupName,
      orderBy: 'LastEventTime',
      descending: true,
      limit: 50
    });
    
    return await this.logsService.describeLogStreams(command);
  }

  // Get log events from a specific stream
  async getLogEvents(logGroupName: string, logStreamName: string) {
    const command = new GetLogEventsCommand({
      logGroupName,
      logStreamName,
      startFromHead: false,
      limit: 100
    });
    
    return await this.logsService.getLogEvents(command);
  }

  // Start a CloudWatch Insights query
  async startInsightsQuery(logGroupName: string, queryString: string) {
    const command = new StartQueryCommand({
      logGroupName,
      startTime: Math.floor((Date.now() - 3600000) / 1000), // 1 hour ago
      endTime: Math.floor(Date.now() / 1000),
      queryString // e.g., 'fields @timestamp, @message | sort @timestamp desc | limit 20'
    });
    
    return await this.logsService.startQuery(command);
  }

  // Get query results
  async getQueryResults(queryId: string) {
    const command = new GetQueryResultsCommand({ queryId });
    return await this.logsService.getQueryResults(command);
  }

  // Stop a running query
  async stopQuery(queryId: string) {
    const command = new StopQueryCommand({ queryId });
    return await this.logsService.stopQuery(command);
  }
}
```

## Available Methods

### CloudwatchService Methods
- `putMetricData(command)` - Send custom metrics to CloudWatch
- `getMetricStatistics(command)` - Retrieve metric statistics
- `listMetrics(command)` - List available metrics
- `putDashboard(command)` - Create or update dashboards
- `getDashboard(command)` - Retrieve dashboard configuration
- `deleteDashboards(command)` - Delete dashboards

### CloudwatchLogsService Methods
- `filterLogEvents(command)` - Search and filter log events
- `describeLogGroups(command)` - List log groups
- `describeLogStreams(command)` - List log streams in a group
- `getLogEvents(command)` - Retrieve events from a log stream
- `startQuery(command)` - Start a CloudWatch Insights query
- `getQueryResults(command)` - Get results of an Insights query
- `stopQuery(command)` - Stop a running query

## Direct Client Access

Both services expose their underlying AWS SDK clients for advanced use cases:

```typescript
// Access the raw CloudWatch client
const client = this.cloudwatchService.cloudwatchClient;

// Access the raw CloudWatch Logs client  
const logsClient = this.logsService.cloudwatchLogsClient;
```

## Environment Variables

Configure the module using these environment variables:

```bash
# Optional: AWS profile to use
AWS_PROFILE=my-profile

# Required: AWS region
AWS_REGION=us-east-1
```

## AWS Credentials

The module uses the standard AWS SDK credential resolution chain:
1. Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
2. Shared credentials file (`~/.aws/credentials`)
3. IAM roles for EC2/ECS/Lambda
4. AWS profile (if `AWS_PROFILE` is set)

## License

MIT