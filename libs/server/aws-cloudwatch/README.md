# @onivoro/server-aws-cloudwatch

AWS CloudWatch integration for NestJS applications, providing services for CloudWatch metrics, CloudWatch Logs, and HIPAA-style audit logging.

## Installation

```bash
npm install @onivoro/server-aws-cloudwatch @aws-sdk/client-cloudwatch @aws-sdk/client-cloudwatch-logs @nestjs/common
```

`@aws-sdk/client-cloudwatch`, `@aws-sdk/client-cloudwatch-logs` and `@nestjs/common` are peer dependencies.

## Overview

This library provides NestJS services for interacting with AWS CloudWatch and CloudWatch Logs:

- **`ServerAwsCloudwatchModule`** provides:
  - **CloudwatchService**: CloudWatch metrics and dashboards
  - **CloudwatchLogsService**: CloudWatch Logs reads and Logs Insights queries
- **`ServerAwsCloudwatchHippaModule`** provides:
  - **CloudwatchHippaService**: writes structured access-audit events to a log group

## Configuration

```typescript
export class ServerAwsCloudwatchConfig {
  AWS_PROFILE?: string; // AWS profile to use (optional)
  AWS_REGION: string; // AWS region for CloudWatch
}

export class ServerAwsCloudwatchHippaConfig extends ServerAwsCloudwatchConfig {
  LOG_GROUP: string; // existing log group that receives audit events
}
```

The modules do not read environment variables themselves; pass the values in through the config object.

## Usage

### Module Setup

`configure` requires a config object:

```typescript
import { Module } from '@nestjs/common';
import { ServerAwsCloudwatchModule } from '@onivoro/server-aws-cloudwatch';

@Module({
  imports: [
    ServerAwsCloudwatchModule.configure({
      AWS_REGION: process.env.AWS_REGION!,
      AWS_PROFILE: process.env.AWS_PROFILE,
    }),
  ],
})
export class AppModule {}
```

`ServerAwsCloudwatchModule` registers and exports `CloudWatchClient`, `CloudWatchLogsClient`, `ServerAwsCloudwatchConfig`, `CloudwatchService` and `CloudwatchLogsService`. It also re-exports `ServerAwsCredentialProvidersModule` (`AwsCredentials`).

### CloudWatch Service

Each `CloudwatchService` method takes an `@aws-sdk/client-cloudwatch` command instance and returns the result of `client.send(command)`:

```typescript
import { Injectable } from '@nestjs/common';
import { CloudwatchService } from '@onivoro/server-aws-cloudwatch';
import { PutMetricDataCommand, GetMetricStatisticsCommand, ListMetricsCommand, PutDashboardCommand } from '@aws-sdk/client-cloudwatch';

@Injectable()
export class MetricsService {
  constructor(private readonly cloudwatchService: CloudwatchService) {}

  // Put custom metrics
  async recordMetric() {
    const command = new PutMetricDataCommand({
      Namespace: 'MyApp',
      MetricData: [
        {
          MetricName: 'PageViews',
          Value: 1,
          Timestamp: new Date(),
          Dimensions: [{ Name: 'PageName', Value: 'HomePage' }],
        },
      ],
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
      Statistics: ['Average', 'Sum'],
    });

    return await this.cloudwatchService.getMetricStatistics(command);
  }

  // List available metrics
  async listAvailableMetrics() {
    return await this.cloudwatchService.listMetrics(new ListMetricsCommand({ Namespace: 'MyApp' }));
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
              title: 'Page Views',
            },
          },
        ],
      }),
    });

    return await this.cloudwatchService.putDashboard(command);
  }
}
```

### CloudWatch Logs Service

The low-level `CloudwatchLogsService` methods take an `@aws-sdk/client-cloudwatch-logs` command instance and return `client.send(command)`:

```typescript
import { Injectable } from '@nestjs/common';
import { CloudwatchLogsService } from '@onivoro/server-aws-cloudwatch';
import { FilterLogEventsCommand, DescribeLogGroupsCommand, DescribeLogStreamsCommand, GetLogEventsCommand, StartQueryCommand, GetQueryResultsCommand, DescribeQueriesCommand, StopQueryCommand } from '@aws-sdk/client-cloudwatch-logs';

@Injectable()
export class LoggingService {
  constructor(private readonly logsService: CloudwatchLogsService) {}

  // Filter log events
  async searchLogs(logGroupName: string, filterPattern?: string) {
    return await this.logsService.filterLogEvents(
      new FilterLogEventsCommand({
        logGroupName,
        filterPattern,
        startTime: Date.now() - 3600000, // 1 hour ago
        endTime: Date.now(),
      }),
    );
  }

  // List log groups
  async listLogGroups() {
    return await this.logsService.describeLogGroups(new DescribeLogGroupsCommand({ limit: 50 }));
  }

  // List log streams in a group
  async listLogStreams(logGroupName: string) {
    return await this.logsService.describeLogStreams(
      new DescribeLogStreamsCommand({
        logGroupName,
        orderBy: 'LastEventTime',
        descending: true,
        limit: 50,
      }),
    );
  }

  // Get log events from a specific stream
  async getLogEvents(logGroupName: string, logStreamName: string) {
    return await this.logsService.getLogEvents(
      new GetLogEventsCommand({
        logGroupName,
        logStreamName,
        startFromHead: false,
        limit: 100,
      }),
    );
  }

  // Start a CloudWatch Logs Insights query
  async startInsightsQuery(logGroupName: string, queryString: string) {
    return await this.logsService.startQuery(
      new StartQueryCommand({
        logGroupName,
        startTime: Math.floor((Date.now() - 3600000) / 1000), // seconds
        endTime: Math.floor(Date.now() / 1000),
        queryString, // e.g. 'fields @timestamp, @message | sort @timestamp desc | limit 20'
      }),
    );
  }

  async getQueryResults(queryId: string) {
    return await this.logsService.getQueryResults(new GetQueryResultsCommand({ queryId }));
  }

  async listRunningQueries(logGroupName: string) {
    return await this.logsService.describeQueries(new DescribeQueriesCommand({ logGroupName, status: 'Running' }));
  }

  async stopQuery(queryId: string) {
    return await this.logsService.stopQuery(new StopQueryCommand({ queryId }));
  }
}
```

#### Helper methods

`CloudwatchLogsService` also has higher-level helpers that take plain parameters:

```typescript
// FilterLogEvents with a pattern. maxItems defaults to 100 (sent as `limit`).
await logsService.searchLogsByPattern({
  logGroupName: '/aws/lambda/my-fn',
  filterPattern: '"Task timed out"',
  startTime: new Date(Date.now() - 24 * 3600_000), // optional
  endTime: new Date(), // optional
  maxItems: 50, // optional
});

// searchLogsByPattern with the pattern '?ERROR ?error ?Error ?EXCEPTION ?exception ?Exception'
await logsService.searchErrorLogs({ logGroupName: '/aws/lambda/my-fn' });

// Last `minutes` (default 60) of logs, up to maxItems (default 100).
// With logStreamName it uses GetLogEvents; without it, FilterLogEvents across the group.
await logsService.getRecentLogs({ logGroupName: '/ecs/api', logStreamName: 'api/web/abc123', minutes: 15 });

// Starts an Insights query over several log groups and polls GetQueryResults every
// pollIntervalMs until status is 'Complete', then returns the GetQueryResults output.
const results = await logsService.searchLogsWithInsights({
  logGroupNames: ['/ecs/api', '/ecs/worker'],
  queryString: 'fields @timestamp, @message | filter @message like /ERROR/ | limit 50',
  startTime: new Date(Date.now() - 3600_000),
  endTime: new Date(),
  pollIntervalMs: 1000, // optional, default 1000
  timeoutMs: 5 * 60_000, // optional, default 15 minutes
});
```

`searchLogsWithInsights` throws if `StartQuery` returns no `queryId`, or if the query ends with status `Failed`, `Cancelled` or `Timeout`. If the query has not completed within `timeoutMs`, it sends `StopQuery` (ignoring any error from it) and throws.

### HIPAA Audit Logging

`ServerAwsCloudwatchHippaModule` (note the `Hippa` spelling in the export names) registers and exports `CloudWatchLogsClient`, `ServerAwsCloudwatchHippaConfig` and `CloudwatchHippaService`.

```typescript
import { Module, Injectable } from '@nestjs/common';
import { ServerAwsCloudwatchHippaModule, CloudwatchHippaService } from '@onivoro/server-aws-cloudwatch';

@Module({
  imports: [
    ServerAwsCloudwatchHippaModule.configure({
      AWS_REGION: process.env.AWS_REGION!,
      LOG_GROUP: '/my-app/hipaa-audit', // must already exist
    }),
  ],
})
export class AuditModule {}

@Injectable()
export class PatientAccessAuditor {
  constructor(private readonly hippa: CloudwatchHippaService) {}

  recordRead(email: string, patientIds: string[]) {
    return this.hippa.writeHippaEvent({
      accessPoint: 'GET /api/patients',
      resourceType: 'Patient',
      resourceIds: patientIds,
      accessEmail: email,
      accessType: 'read', // optional
    });
  }
}
```

`writeHippaEvent(event)` returns `Promise<PutLogEventsCommandOutput>` and works as follows:

- Writes to `config.LOG_GROUP`, in a daily stream named `hipaa-audit-YYYY-MM-DD` (UTC date).
- On the first write to a stream, it calls `DescribeLogStreams` and creates the stream with `CreateLogStream` if it is missing. If `CreateLogStream` fails with `ResourceAlreadyExistsException` (another writer created the stream first), the write goes ahead. Other errors are rethrown. Known streams are cached in memory, and entries older than 72 hours are evicted. It does not create the log group.
- Each call sends one log event whose `message` is `JSON.stringify({ timestamp, accessPoint, resourceType, resourceIds, accessEmail, accessType })`.

### Direct Client Access

`CloudwatchService` exposes its client as the public `cloudwatchClient` property. `CloudwatchLogsService` keeps its client private, but both modules export the SDK clients, so you can inject them directly:

```typescript
import { Injectable } from '@nestjs/common';
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';
import { CloudWatchLogsClient, PutRetentionPolicyCommand } from '@aws-sdk/client-cloudwatch-logs';

@Injectable()
export class RawClients {
  constructor(
    private readonly cloudwatch: CloudWatchClient,
    private readonly logs: CloudWatchLogsClient,
  ) {}

  setRetention(logGroupName: string) {
    return this.logs.send(new PutRetentionPolicyCommand({ logGroupName, retentionInDays: 30 }));
  }
}
```

## Available Methods

### CloudwatchService

- `putMetricData(command: PutMetricDataCommand)`: send custom metrics
- `getMetricStatistics(command: GetMetricStatisticsCommand)`: retrieve metric statistics
- `listMetrics(command: ListMetricsCommand)`: list available metrics
- `putDashboard(command: PutDashboardCommand)`: create or update a dashboard
- `getDashboard(command: GetDashboardCommand)`: retrieve a dashboard
- `deleteDashboards(command: DeleteDashboardsCommand)`: delete dashboards
- `cloudwatchClient`: public `CloudWatchClient`

### CloudwatchLogsService

- `filterLogEvents(command: FilterLogEventsCommand)`
- `describeLogGroups(command: DescribeLogGroupsCommand)`
- `describeLogStreams(command: DescribeLogStreamsCommand)`
- `getLogEvents(command: GetLogEventsCommand)`
- `startQuery(command: StartQueryCommand)`
- `getQueryResults(command: GetQueryResultsCommand)`
- `describeQueries(command: DescribeQueriesCommand)`
- `stopQuery(command: StopQueryCommand)`
- `searchLogsByPattern({ logGroupName, filterPattern, startTime?, endTime?, maxItems? = 100 })`
- `searchLogsWithInsights({ logGroupNames, queryString, startTime, endTime, pollIntervalMs? = 1000, timeoutMs? = 900000 })`
- `getRecentLogs({ logGroupName, logStreamName?, minutes? = 60, maxItems? = 100 })`
- `searchErrorLogs({ logGroupName, startTime?, endTime?, maxItems? = 100 })`

### CloudwatchHippaService

- `writeHippaEvent({ accessPoint, resourceType, resourceIds, accessEmail, accessType? })`

## AWS Credentials

Credentials come from [`@onivoro/server-aws-credential-providers`](../aws-credential-providers/):

- When `AWS_PROFILE` is set in the config, the profile is resolved with `fromIni`. If that fails, the module falls back to `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` environment variables.
- When `AWS_PROFILE` is not set, the clients use the AWS SDK default credential chain (environment variables, shared files, IAM roles for EC2/ECS/Lambda, and so on).

## License

MIT
