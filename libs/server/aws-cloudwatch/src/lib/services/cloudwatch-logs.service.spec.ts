import { CloudwatchLogsService } from './cloudwatch-logs.service';
import { ServerAwsCloudwatchConfig } from '../classes/server-aws-cloudwatch-config.class';
import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
  DescribeLogStreamsCommand,
  DescribeQueriesCommand,
  FilterLogEventsCommand,
  GetLogEventsCommand,
  GetQueryResultsCommand,
  StartQueryCommand,
  StopQueryCommand,
} from '@aws-sdk/client-cloudwatch-logs';

describe(CloudwatchLogsService.name, () => {
  let service: CloudwatchLogsService;
  let mockSend: jest.Mock;

  const params = {
    logGroupNames: ['/ecs/api'],
    queryString: 'fields @message',
    startTime: new Date('2025-01-01T00:00:00.000Z'),
    endTime: new Date('2025-01-01T01:00:00.000Z'),
    pollIntervalMs: 1,
  };

  beforeEach(() => {
    mockSend = jest.fn();
    service = new CloudwatchLogsService(
      { send: mockSend } as unknown as CloudWatchLogsClient,
      {} as ServerAwsCloudwatchConfig,
    );
  });

  describe('searchLogsWithInsights', () => {
    it('polls until Complete and returns the results', async () => {
      const complete = { status: 'Complete', results: [] };
      mockSend
        .mockResolvedValueOnce({ queryId: 'q1' }) // StartQuery
        .mockResolvedValueOnce({ status: 'Running' })
        .mockResolvedValueOnce(complete);

      await expect(service.searchLogsWithInsights(params)).resolves.toBe(
        complete,
      );
      expect(mockSend).toHaveBeenNthCalledWith(
        1,
        expect.any(StartQueryCommand),
      );
      expect(mockSend).toHaveBeenNthCalledWith(
        3,
        expect.any(GetQueryResultsCommand),
      );
    });

    it('throws when StartQuery returns no queryId', async () => {
      mockSend.mockResolvedValueOnce({});

      await expect(service.searchLogsWithInsights(params)).rejects.toThrow(
        'Failed to start CloudWatch Insights query',
      );
    });

    it.each(['Failed', 'Cancelled', 'Timeout'])(
      'throws on terminal status %s',
      async (status) => {
        mockSend
          .mockResolvedValueOnce({ queryId: 'q1' })
          .mockResolvedValueOnce({ status });

        await expect(service.searchLogsWithInsights(params)).rejects.toThrow(
          `ended with status ${status}`,
        );
        expect(mockSend).toHaveBeenCalledTimes(2);
      },
    );

    it('stops the query and throws when timeoutMs elapses', async () => {
      mockSend.mockImplementation(async (command: unknown) => {
        if (command instanceof StartQueryCommand) return { queryId: 'q1' };
        if (command instanceof StopQueryCommand) return { success: true };
        return { status: 'Running' };
      });

      await expect(
        service.searchLogsWithInsights({ ...params, timeoutMs: 20 }),
      ).rejects.toThrow('did not complete within 20ms');
      expect(mockSend).toHaveBeenLastCalledWith(expect.any(StopQueryCommand));
    });
  });

  describe('searchLogsWithInsights (request shape and timing)', () => {
    afterEach(() => jest.useRealTimers());

    it('sends epoch-second times and polls at pollIntervalMs', async () => {
      jest.useFakeTimers();
      mockSend
        .mockResolvedValueOnce({ queryId: 'q1' })
        .mockResolvedValueOnce({ status: 'Scheduled' })
        .mockResolvedValueOnce({ status: 'Complete' });

      const result = service.searchLogsWithInsights({
        ...params,
        startTime: new Date('2025-01-01T00:00:00.999Z'),
        pollIntervalMs: 250,
      });
      await jest.advanceTimersByTimeAsync(249);
      expect(mockSend).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      expect(mockSend).toHaveBeenCalledTimes(2);
      await jest.advanceTimersByTimeAsync(250);

      await expect(result).resolves.toEqual({ status: 'Complete' });
      expect(mockSend.mock.calls[0][0].input).toEqual({
        logGroupNames: ['/ecs/api'],
        queryString: 'fields @message',
        startTime: 1735689600,
        endTime: 1735693200,
      });
      expect(mockSend.mock.calls[1][0].input).toEqual({ queryId: 'q1' });
    });

    it('still throws the timeout error when StopQuery fails', async () => {
      mockSend.mockImplementation(async (command: unknown) => {
        if (command instanceof StartQueryCommand) return { queryId: 'q1' };
        if (command instanceof StopQueryCommand)
          throw new Error('already stopped');
        return { status: 'Running' };
      });

      await expect(
        service.searchLogsWithInsights({ ...params, timeoutMs: 5 }),
      ).rejects.toThrow(
        'CloudWatch Insights query q1 did not complete within 5ms',
      );
    });
  });

  describe('command pass-throughs', () => {
    it.each([
      ['filterLogEvents', new FilterLogEventsCommand({ logGroupName: 'g' })],
      ['describeLogGroups', new DescribeLogGroupsCommand({})],
      [
        'describeLogStreams',
        new DescribeLogStreamsCommand({ logGroupName: 'g' }),
      ],
      [
        'getLogEvents',
        new GetLogEventsCommand({ logGroupName: 'g', logStreamName: 's' }),
      ],
      [
        'startQuery',
        new StartQueryCommand({ queryString: 'q', startTime: 0, endTime: 1 }),
      ],
      ['getQueryResults', new GetQueryResultsCommand({ queryId: 'q' })],
      ['describeQueries', new DescribeQueriesCommand({})],
      ['stopQuery', new StopQueryCommand({ queryId: 'q' })],
    ] as const)(
      '%s sends the command and returns the response',
      async (method, command) => {
        const response = { $metadata: {}, method };
        mockSend.mockResolvedValue(response);

        await expect((service as any)[method](command)).resolves.toBe(response);
        expect(mockSend).toHaveBeenCalledWith(command);
      },
    );
  });

  describe('searchLogsByPattern', () => {
    it('filters by pattern with millisecond times and the given limit', async () => {
      mockSend.mockResolvedValue({ events: [] });

      await service.searchLogsByPattern({
        logGroupName: '/ecs/api',
        filterPattern: '"timeout"',
        startTime: params.startTime,
        endTime: params.endTime,
        maxItems: 5,
      });

      const [command] = mockSend.mock.calls[0];
      expect(command).toBeInstanceOf(FilterLogEventsCommand);
      expect(command.input).toEqual({
        logGroupName: '/ecs/api',
        filterPattern: '"timeout"',
        startTime: params.startTime.getTime(),
        endTime: params.endTime.getTime(),
        limit: 5,
      });
    });

    it('defaults to 100 items and an open time range', async () => {
      mockSend.mockResolvedValue({ events: [] });

      await service.searchLogsByPattern({
        logGroupName: '/ecs/api',
        filterPattern: 'x',
      });

      expect(mockSend.mock.calls[0][0].input).toEqual({
        logGroupName: '/ecs/api',
        filterPattern: 'x',
        startTime: undefined,
        endTime: undefined,
        limit: 100,
      });
    });
  });

  describe('getRecentLogs', () => {
    const now = new Date('2025-06-01T12:00:00.000Z');

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(now);
    });
    afterEach(() => jest.useRealTimers());

    it('reads a single stream with GetLogEvents when a stream is given', async () => {
      mockSend.mockResolvedValue({ events: [] });

      await service.getRecentLogs({
        logGroupName: 'g',
        logStreamName: 's',
        minutes: 5,
        maxItems: 20,
      });

      const [command] = mockSend.mock.calls[0];
      expect(command).toBeInstanceOf(GetLogEventsCommand);
      expect(command.input).toEqual({
        logGroupName: 'g',
        logStreamName: 's',
        startTime: now.getTime() - 5 * 60 * 1000,
        endTime: now.getTime(),
        limit: 20,
      });
    });

    it('filters the whole group over the last hour by default', async () => {
      mockSend.mockResolvedValue({ events: [] });

      await service.getRecentLogs({ logGroupName: 'g' });

      const [command] = mockSend.mock.calls[0];
      expect(command).toBeInstanceOf(FilterLogEventsCommand);
      expect(command.input).toEqual({
        logGroupName: 'g',
        startTime: now.getTime() - 60 * 60 * 1000,
        endTime: now.getTime(),
        limit: 100,
      });
    });
  });

  describe('searchErrorLogs', () => {
    it('filters with the error/exception pattern', async () => {
      mockSend.mockResolvedValue({ events: [] });

      await service.searchErrorLogs({
        logGroupName: 'g',
        startTime: params.startTime,
        maxItems: 7,
      });

      expect(mockSend.mock.calls[0][0].input).toEqual({
        logGroupName: 'g',
        filterPattern: '?ERROR ?error ?Error ?EXCEPTION ?exception ?Exception',
        startTime: params.startTime.getTime(),
        endTime: undefined,
        limit: 7,
      });
    });

    it('defaults to 100 items', async () => {
      mockSend.mockResolvedValue({ events: [] });

      await service.searchErrorLogs({ logGroupName: 'g' });

      expect(mockSend.mock.calls[0][0].input.limit).toBe(100);
    });
  });
});
