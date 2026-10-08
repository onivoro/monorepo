import { FirehoseClient, PutRecordCommand } from '@aws-sdk/client-firehose';
import { FirehoseService } from './firehose.service';
import { ServerAwsFirehoseConfig } from '../server-aws-firehose-config.class';

describe(FirehoseService.name, () => {
  let service: FirehoseService;
  let mockSend: jest.Mock;
  const config: ServerAwsFirehoseConfig = {
    AWS_FIREHOSE_NAME: 'delivery-stream',
    AWS_REGION: 'us-east-1',
  };

  beforeEach(() => {
    mockSend = jest.fn().mockResolvedValue({ RecordId: 'r-1' });
    service = new FirehoseService(config, {
      send: mockSend,
    } as unknown as FirehoseClient);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('putRecord', () => {
    it('sends newline-delimited JSON to the configured delivery stream', async () => {
      const data = { userId: 'u1', action: 'login' };

      await expect(service.putRecord(data, 'evt-1')).resolves.toBeUndefined();

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command).toBeInstanceOf(PutRecordCommand);
      expect(command.input.DeliveryStreamName).toBe('delivery-stream');
      expect(Buffer.isBuffer(command.input.Record.Data)).toBe(true);
      expect(command.input.Record.Data.toString('utf8')).toBe(
        '{"userId":"u1","action":"login"}\n',
      );
    });

    it('logs and rethrows client errors', async () => {
      const error = new Error('ResourceNotFound');
      mockSend.mockRejectedValue(error);

      await expect(service.putRecord({ a: 1 }, 'evt-1')).rejects.toBe(error);
      expect(console.error).toHaveBeenCalledWith({
        detail: 'failed to put record to Firehose',
        error: 'ResourceNotFound',
      });
    });

    it('logs and rethrows non-Error rejections', async () => {
      mockSend.mockRejectedValue(undefined);

      await expect(
        service.putRecord({ a: 1 }, 'evt-1'),
      ).rejects.toBeUndefined();
      expect(console.error).toHaveBeenCalledWith({
        detail: 'failed to put record to Firehose',
        error: undefined,
      });
    });
  });
});
