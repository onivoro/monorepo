import {
  CloudWatchClient,
  DeleteDashboardsCommand,
  GetDashboardCommand,
  GetMetricStatisticsCommand,
  ListMetricsCommand,
  PutDashboardCommand,
  PutMetricDataCommand,
} from '@aws-sdk/client-cloudwatch';
import { CloudwatchService } from './cloudwatch.service';
import { ServerAwsCloudwatchConfig } from '../classes/server-aws-cloudwatch-config.class';

describe(CloudwatchService.name, () => {
  let send: jest.Mock;
  let service: CloudwatchService;

  beforeEach(() => {
    send = jest.fn();
    service = new CloudwatchService(
      { send } as unknown as CloudWatchClient,
      {
        AWS_REGION: 'us-east-1',
      } as ServerAwsCloudwatchConfig,
    );
  });

  it.each([
    [
      'putMetricData',
      new PutMetricDataCommand({ Namespace: 'App', MetricData: [] }),
    ],
    [
      'getMetricStatistics',
      new GetMetricStatisticsCommand({
        Namespace: 'App',
        MetricName: 'Latency',
        StartTime: new Date(0),
        EndTime: new Date(1),
        Period: 60,
      }),
    ],
    ['listMetrics', new ListMetricsCommand({ Namespace: 'App' })],
    [
      'putDashboard',
      new PutDashboardCommand({ DashboardName: 'd', DashboardBody: '{}' }),
    ],
    ['getDashboard', new GetDashboardCommand({ DashboardName: 'd' })],
    [
      'deleteDashboards',
      new DeleteDashboardsCommand({ DashboardNames: ['d'] }),
    ],
  ] as const)(
    '%s sends the command and returns the response',
    async (method, command) => {
      const response = { $metadata: {}, method };
      send.mockResolvedValue(response);

      await expect((service as any)[method](command)).resolves.toBe(response);
      expect(send).toHaveBeenCalledWith(command);
    },
  );

  it('propagates client errors', async () => {
    const error = new Error('throttled');
    send.mockRejectedValue(error);

    await expect(service.listMetrics(new ListMetricsCommand({}))).rejects.toBe(
      error,
    );
  });

  it('exposes the underlying client', () => {
    expect(service.cloudwatchClient.send).toBe(send);
  });
});
