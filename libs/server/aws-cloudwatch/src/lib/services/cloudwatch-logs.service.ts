import { Injectable } from '@nestjs/common';
import {
  CloudWatchLogsClient,
  FilterLogEventsCommand,
  DescribeLogGroupsCommand,
  DescribeLogStreamsCommand,
  GetLogEventsCommand,
  StartQueryCommand,
  GetQueryResultsCommand,
  DescribeQueriesCommand,
  StopQueryCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import { ServerAwsCloudwatchConfig } from '../classes/server-aws-cloudwatch-config.class';

@Injectable()
export class CloudwatchLogsService {
  constructor(
    private readonly cloudwatchLogsClient: CloudWatchLogsClient,
    private config: ServerAwsCloudwatchConfig,
  ) {}

  async filterLogEvents(filterLogEventsCommand: FilterLogEventsCommand) {
    return await this.cloudwatchLogsClient.send(filterLogEventsCommand);
  }

  async describeLogGroups(describeLogGroupsCommand: DescribeLogGroupsCommand) {
    return await this.cloudwatchLogsClient.send(describeLogGroupsCommand);
  }

  async describeLogStreams(
    describeLogStreamsCommand: DescribeLogStreamsCommand,
  ) {
    return await this.cloudwatchLogsClient.send(describeLogStreamsCommand);
  }

  async getLogEvents(getLogEventsCommand: GetLogEventsCommand) {
    return await this.cloudwatchLogsClient.send(getLogEventsCommand);
  }

  async startQuery(startQueryCommand: StartQueryCommand) {
    return await this.cloudwatchLogsClient.send(startQueryCommand);
  }

  async getQueryResults(getQueryResultsCommand: GetQueryResultsCommand) {
    return await this.cloudwatchLogsClient.send(getQueryResultsCommand);
  }

  async describeQueries(describeQueriesCommand: DescribeQueriesCommand) {
    return await this.cloudwatchLogsClient.send(describeQueriesCommand);
  }

  async stopQuery(stopQueryCommand: StopQueryCommand) {
    return await this.cloudwatchLogsClient.send(stopQueryCommand);
  }

  // Helper methods for common log searching use cases
  async searchLogsByPattern(params: {
    logGroupName: string;
    filterPattern: string;
    startTime?: Date;
    endTime?: Date;
    maxItems?: number;
  }) {
    const {
      logGroupName,
      filterPattern,
      startTime,
      endTime,
      maxItems = 100,
    } = params;

    const command = new FilterLogEventsCommand({
      logGroupName,
      filterPattern,
      startTime: startTime?.getTime(),
      endTime: endTime?.getTime(),
      limit: maxItems,
    });

    return await this.filterLogEvents(command);
  }

  async searchLogsWithInsights(params: {
    logGroupNames: string[];
    queryString: string;
    startTime: Date;
    endTime: Date;
    pollIntervalMs?: number;
    timeoutMs?: number;
  }) {
    const {
      logGroupNames,
      queryString,
      startTime,
      endTime,
      pollIntervalMs = 1000,
      timeoutMs = 15 * 60 * 1000,
    } = params;

    const startCommand = new StartQueryCommand({
      logGroupNames,
      queryString,
      startTime: Math.floor(startTime.getTime() / 1000),
      endTime: Math.floor(endTime.getTime() / 1000),
    });

    const startResult = await this.startQuery(startCommand);
    const queryId = startResult.queryId;

    if (!queryId) {
      throw new Error('Failed to start CloudWatch Insights query');
    }

    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

      const results = await this.getQueryResults(
        new GetQueryResultsCommand({ queryId }),
      );

      if (results.status === 'Complete') {
        return results;
      }

      if (
        results.status === 'Failed' ||
        results.status === 'Cancelled' ||
        results.status === 'Timeout'
      ) {
        throw new Error(
          `CloudWatch Insights query ${queryId} ended with status ${results.status}`,
        );
      }
    }

    try {
      await this.stopQuery(new StopQueryCommand({ queryId }));
    } catch {
      // Best effort: the query may have finished or been stopped already.
    }

    throw new Error(
      `CloudWatch Insights query ${queryId} did not complete within ${timeoutMs}ms`,
    );
  }

  async getRecentLogs(params: {
    logGroupName: string;
    logStreamName?: string;
    minutes?: number;
    maxItems?: number;
  }) {
    const {
      logGroupName,
      logStreamName,
      minutes = 60,
      maxItems = 100,
    } = params;

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - minutes * 60 * 1000);

    if (logStreamName) {
      const command = new GetLogEventsCommand({
        logGroupName,
        logStreamName,
        startTime: startTime.getTime(),
        endTime: endTime.getTime(),
        limit: maxItems,
      });

      return await this.getLogEvents(command);
    } else {
      const command = new FilterLogEventsCommand({
        logGroupName,
        startTime: startTime.getTime(),
        endTime: endTime.getTime(),
        limit: maxItems,
      });

      return await this.filterLogEvents(command);
    }
  }

  async searchErrorLogs(params: {
    logGroupName: string;
    startTime?: Date;
    endTime?: Date;
    maxItems?: number;
  }) {
    const { logGroupName, startTime, endTime, maxItems = 100 } = params;

    return await this.searchLogsByPattern({
      logGroupName,
      filterPattern: '?ERROR ?error ?Error ?EXCEPTION ?exception ?Exception',
      startTime,
      endTime,
      maxItems,
    });
  }
}
