import { KinesisClient, PutRecordCommand } from '@aws-sdk/client-kinesis';
import { KinesisService } from './kinesis.service';
import { ServerAwsKinesisConfig } from '../classes/server-aws-kinesis-config.class';

describe(KinesisService.name, () => {
  let service: KinesisService;
  let mockSend: jest.Mock;
  const config: ServerAwsKinesisConfig = {
    AWS_KINESIS_NAME: 'events-stream',
    AWS_REGION: 'us-east-1',
  };

  beforeEach(() => {
    mockSend = jest.fn().mockResolvedValue({ SequenceNumber: '1' });
    service = new KinesisService(
      { send: mockSend } as unknown as KinesisClient,
      config,
    );
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('publish', () => {
    it('sends a PutRecordCommand with the JSON-encoded event', async () => {
      const event = { type: 'created', id: 42, nested: { ok: true } };

      await expect(service.publish(event, 'pk-1')).resolves.toBeUndefined();

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command).toBeInstanceOf(PutRecordCommand);
      expect(command.input.StreamName).toBe('events-stream');
      expect(command.input.PartitionKey).toBe('pk-1');
      expect(Buffer.isBuffer(command.input.Data)).toBe(true);
      expect(JSON.parse(command.input.Data.toString('utf8'))).toEqual(event);
    });

    it('encodes primitive events', async () => {
      await service.publish('hello', 'pk');

      expect(mockSend.mock.calls[0][0].input.Data.toString('utf8')).toBe(
        '"hello"',
      );
    });

    it('logs and swallows client errors', async () => {
      const error = new Error('ProvisionedThroughputExceeded');
      mockSend.mockRejectedValue(error);
      const event = { id: 1 };

      await expect(service.publish(event, 'pk')).resolves.toBeUndefined();
      expect(console.error).toHaveBeenCalledWith(
        'Error sending data to Kinesis:',
        event,
        error,
      );
    });

    it('logs and swallows serialization errors without calling the client', async () => {
      const circular: any = {};
      circular.self = circular;

      await expect(service.publish(circular, 'pk')).resolves.toBeUndefined();
      expect(mockSend).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        'Error sending data to Kinesis:',
        circular,
        expect.any(TypeError),
      );
    });
  });
});
