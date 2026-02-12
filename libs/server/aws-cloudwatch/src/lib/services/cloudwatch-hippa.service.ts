import { Injectable } from '@nestjs/common';
import {
    CloudWatchLogsClient,
    CreateLogStreamCommand,
    DescribeLogStreamsCommand,
    PutLogEventsCommand,
    PutLogEventsCommandInput,
    PutLogEventsCommandOutput,
} from '@aws-sdk/client-cloudwatch-logs';

import { ServerAwsCloudwatchHippaConfig } from '../classes/server-aws-cloudwatch-hippa-config.class';

@Injectable()
export class CloudwatchHippaService {
    private static readonly CACHE_TTL_HOURS = 72;
    private static readonly LOG_STREAM_PREFIX = 'hipaa-audit-';
    private existingLogStreams = new Set<string>();

    constructor(
        private readonly cloudwatchLogsClient: CloudWatchLogsClient,
        private config: ServerAwsCloudwatchHippaConfig
    ) { }

    private evictStaleCacheKeys(currentDate: Date): void {
        const cutoffTime = currentDate.getTime() - (CloudwatchHippaService.CACHE_TTL_HOURS * 60 * 60 * 1000);

        for (const cacheKey of this.existingLogStreams) {
            const dateMatch = cacheKey.match(/hipaa-audit-(\d{4}-\d{2}-\d{2})$/);
            if (dateMatch) {
                const keyDate = new Date(dateMatch[1]).getTime();
                if (keyDate < cutoffTime) {
                    this.existingLogStreams.delete(cacheKey);
                }
            }
        }
    }

    private async ensureLogStreamExists(logGroupName: string, logStreamName: string): Promise<void> {
        const cacheKey = `${logGroupName}:${logStreamName}`;

        if (this.existingLogStreams.has(cacheKey)) {
            return;
        }

        const { logStreams } = await this.cloudwatchLogsClient.send(
            new DescribeLogStreamsCommand({ logGroupName, logStreamNamePrefix: logStreamName, limit: 1 })
        );

        if (!logStreams?.some(s => s.logStreamName === logStreamName)) {
            await this.cloudwatchLogsClient.send(
                new CreateLogStreamCommand({ logGroupName, logStreamName })
            );
        }

        const currentDate = new Date(logStreamName.replace(CloudwatchHippaService.LOG_STREAM_PREFIX, ''));
        this.evictStaleCacheKeys(currentDate);
        this.existingLogStreams.add(cacheKey);
    }

    async writeHippaEvent(event: { accessPoint: string, resourceType: string, resourceIds: string[], accessEmail: string, operation: string }): Promise<PutLogEventsCommandOutput> {
        const logGroupName = this.config.LOG_GROUP;
        const logStreamName = `${CloudwatchHippaService.LOG_STREAM_PREFIX}${new Date().toISOString().split('T')[0]}`;

        await this.ensureLogStreamExists(logGroupName, logStreamName);

        const logEvent = {
            timestamp: Date.now(),
            accessPoint: event.accessPoint,
            resourceType: event.resourceType,
            resourceIds: event.resourceIds,
            accessEmail: event.accessEmail,
            operation: event.operation,
        };

        const input: PutLogEventsCommandInput = {
            logGroupName,
            logStreamName,
            logEvents: [
                {
                    timestamp: logEvent.timestamp,
                    message: JSON.stringify(logEvent),
                },
            ],
        };

        const command = new PutLogEventsCommand(input);
        return await this.cloudwatchLogsClient.send(command);
    }
}