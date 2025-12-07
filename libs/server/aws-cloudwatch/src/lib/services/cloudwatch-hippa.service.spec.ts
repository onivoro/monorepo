import { CloudwatchHippaService } from './cloudwatch-hippa.service';
import { ServerAwsCloudwatchHippaConfig } from '../classes/server-aws-cloudwatch-hippa-config.class';
import {
    CloudWatchLogsClient,
    CreateLogStreamCommand,
    PutLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';

describe(CloudwatchHippaService.name, () => {
    let service: CloudwatchHippaService;
    let mockSend: jest.Mock;
    let mockCloudWatchLogsClient: CloudWatchLogsClient;
    let mockConfig: ServerAwsCloudwatchHippaConfig;

    const mockEvent = {
        accessPoint: '/api/patients',
        resourceType: 'Patient',
        resourceIds: ['patient-123', 'patient-456'],
        accessEmail: 'user@example.com',
    };

    beforeEach(() => {
        mockSend = jest.fn();
        mockCloudWatchLogsClient = {
            send: mockSend,
        } as unknown as CloudWatchLogsClient;

        mockConfig = {
            LOG_GROUP: 'hipaa-audit-logs',
            AWS_REGION: 'us-east-1',
        };

        service = new CloudwatchHippaService(mockCloudWatchLogsClient, mockConfig);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    describe('writeHippaEvent', () => {
        it('should create log stream and write event on first call', async () => {
            const mockPutLogEventsResponse = { nextSequenceToken: 'token123' };
            mockSend
                .mockResolvedValueOnce({}) // CreateLogStreamCommand
                .mockResolvedValueOnce(mockPutLogEventsResponse); // PutLogEventsCommand

            const result = await service.writeHippaEvent(mockEvent);

            expect(mockSend).toHaveBeenCalledTimes(2);
            expect(mockSend).toHaveBeenNthCalledWith(
                1,
                expect.any(CreateLogStreamCommand)
            );
            expect(mockSend).toHaveBeenNthCalledWith(
                2,
                expect.any(PutLogEventsCommand)
            );
            expect(result).toEqual(mockPutLogEventsResponse);
        });

        it('should not create log stream on subsequent calls (uses cache)', async () => {
            const mockPutLogEventsResponse = { nextSequenceToken: 'token123' };
            mockSend
                .mockResolvedValueOnce({}) // CreateLogStreamCommand (first call)
                .mockResolvedValue(mockPutLogEventsResponse); // PutLogEventsCommand (all calls)

            await service.writeHippaEvent(mockEvent);
            await service.writeHippaEvent(mockEvent);
            await service.writeHippaEvent(mockEvent);

            // CreateLogStreamCommand should only be called once
            const createStreamCalls = mockSend.mock.calls.filter(
                (call: unknown[]) => call[0] instanceof CreateLogStreamCommand
            );
            expect(createStreamCalls).toHaveLength(1);

            // PutLogEventsCommand should be called 3 times
            const putEventsCalls = mockSend.mock.calls.filter(
                (call: unknown[]) => call[0] instanceof PutLogEventsCommand
            );
            expect(putEventsCalls).toHaveLength(3);
        });

        it('should handle ResourceAlreadyExistsException gracefully', async () => {
            const resourceAlreadyExistsError = new Error('Stream already exists');
            resourceAlreadyExistsError.name = 'ResourceAlreadyExistsException';

            const mockPutLogEventsResponse = { nextSequenceToken: 'token123' };
            mockSend
                .mockRejectedValueOnce(resourceAlreadyExistsError) // CreateLogStreamCommand
                .mockResolvedValueOnce(mockPutLogEventsResponse); // PutLogEventsCommand

            const result = await service.writeHippaEvent(mockEvent);

            expect(result).toEqual(mockPutLogEventsResponse);
        });

        it('should throw non-ResourceAlreadyExistsException errors', async () => {
            const unexpectedError = new Error('Access denied');
            unexpectedError.name = 'AccessDeniedException';

            mockSend.mockRejectedValueOnce(unexpectedError);

            await expect(service.writeHippaEvent(mockEvent)).rejects.toThrow('Access denied');
        });

        it('should include correct event data in log message', async () => {
            jest.useFakeTimers();
            const fixedDate = new Date('2025-12-07T10:00:00.000Z');
            jest.setSystemTime(fixedDate);

            mockSend.mockResolvedValue({});

            await service.writeHippaEvent(mockEvent);

            const putEventsCall = mockSend.mock.calls.find(
                (call: unknown[]) => call[0] instanceof PutLogEventsCommand
            );

            expect(putEventsCall).toBeDefined();
            const command = putEventsCall![0] as PutLogEventsCommand;
            const input = command.input;

            expect(input.logGroupName).toBe('hipaa-audit-logs');
            expect(input.logStreamName).toBe('hipaa-audit-2025-12-07');
            expect(input.logEvents).toHaveLength(1);

            const loggedMessage = JSON.parse(input.logEvents![0].message!);
            expect(loggedMessage.accessPoint).toBe(mockEvent.accessPoint);
            expect(loggedMessage.resourceType).toBe(mockEvent.resourceType);
            expect(loggedMessage.resourceIds).toEqual(mockEvent.resourceIds);
            expect(loggedMessage.accessEmail).toBe(mockEvent.accessEmail);
            expect(loggedMessage.timestamp).toBe(fixedDate.getTime());
        });

        it('should use date-based log stream name', async () => {
            jest.useFakeTimers();
            jest.setSystemTime(new Date('2025-06-15T14:30:00.000Z'));

            mockSend.mockResolvedValue({});

            await service.writeHippaEvent(mockEvent);

            const createStreamCall = mockSend.mock.calls.find(
                (call: unknown[]) => call[0] instanceof CreateLogStreamCommand
            );

            expect(createStreamCall).toBeDefined();
            const command = createStreamCall![0] as CreateLogStreamCommand;
            expect(command.input.logStreamName).toBe('hipaa-audit-2025-06-15');
        });
    });

    describe('cache eviction', () => {
        it('should evict cache keys older than 72 hours', async () => {
            jest.useFakeTimers();

            // Day 1: Write an event
            jest.setSystemTime(new Date('2025-12-01T10:00:00.000Z'));
            mockSend.mockResolvedValue({});
            await service.writeHippaEvent(mockEvent);

            // Day 2: Write another event
            jest.setSystemTime(new Date('2025-12-02T10:00:00.000Z'));
            await service.writeHippaEvent(mockEvent);

            // Clear mock to count fresh
            mockSend.mockClear();
            mockSend.mockResolvedValue({});

            // Day 5 (more than 72 hours after Day 1): Write event
            jest.setSystemTime(new Date('2025-12-05T10:00:00.000Z'));
            await service.writeHippaEvent(mockEvent);

            // Go back to Day 1's date - should need to recreate stream since it was evicted
            jest.setSystemTime(new Date('2025-12-01T10:00:00.000Z'));
            await service.writeHippaEvent(mockEvent);

            // Day 1's stream should have been evicted, so CreateLogStreamCommand should be called
            const createStreamCalls = mockSend.mock.calls.filter(
                (call: unknown[]) => call[0] instanceof CreateLogStreamCommand
            );

            // Should have created streams for Day 5 and Day 1 (recreated after eviction)
            expect(createStreamCalls.length).toBeGreaterThanOrEqual(2);
        });

        it('should not evict cache keys within 72 hours', async () => {
            jest.useFakeTimers();

            // Day 1: Write an event
            jest.setSystemTime(new Date('2025-12-01T10:00:00.000Z'));
            mockSend.mockResolvedValue({});
            await service.writeHippaEvent(mockEvent);

            mockSend.mockClear();
            mockSend.mockResolvedValue({});

            // Day 3 (within 72 hours): Write event and then go back to Day 1
            jest.setSystemTime(new Date('2025-12-03T10:00:00.000Z'));
            await service.writeHippaEvent(mockEvent);

            // Go back to Day 1's date - should still be in cache
            jest.setSystemTime(new Date('2025-12-01T10:00:00.000Z'));
            await service.writeHippaEvent(mockEvent);

            // Day 1's stream should still be cached
            const createStreamCalls = mockSend.mock.calls.filter(
                (call: unknown[]) => call[0] instanceof CreateLogStreamCommand
            );

            // Should only have created stream for Day 3, not Day 1 again
            expect(createStreamCalls).toHaveLength(1);
        });
    });
});
