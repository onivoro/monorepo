import { Injectable } from '@nestjs/common';
import {
    CloudWatchClient,
    PutMetricDataCommand,
    GetMetricStatisticsCommand,
    ListMetricsCommand,
    PutDashboardCommand,
    GetDashboardCommand,
    DeleteDashboardsCommand
} from '@aws-sdk/client-cloudwatch';
import { ServerAwsCloudwatchConfig } from '../classes/server-aws-cloudwatch-config.class';

@Injectable()
export class CloudwatchService {
    constructor(
        public readonly cloudwatchClient: CloudWatchClient,
        private config: ServerAwsCloudwatchConfig
    ) { }

    async putMetricData(putMetricDataCommand: PutMetricDataCommand) {
        return await this.cloudwatchClient.send(putMetricDataCommand);
    }

    async getMetricStatistics(getMetricStatisticsCommand: GetMetricStatisticsCommand) {
        return await this.cloudwatchClient.send(getMetricStatisticsCommand);
    }

    async listMetrics(listMetricsCommand: ListMetricsCommand) {
        return await this.cloudwatchClient.send(listMetricsCommand);
    }

    async putDashboard(putDashboardCommand: PutDashboardCommand) {
        return await this.cloudwatchClient.send(putDashboardCommand);
    }

    async getDashboard(getDashboardCommand: GetDashboardCommand) {
        return await this.cloudwatchClient.send(getDashboardCommand);
    }

    async deleteDashboards(deleteDashboardsCommand: DeleteDashboardsCommand) {
        return await this.cloudwatchClient.send(deleteDashboardsCommand);
    }
}