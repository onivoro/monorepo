import {
  DeleteMessageBatchCommand,
  GetQueueAttributesCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { SqsService } from './sqs.service';
import { ServerAwsSqsConfig } from '../classes/server-aws-sqs-config.class';

describe(SqsService.name, () => {
  const config: ServerAwsSqsConfig = {
    AWS_REGION: 'us-east-1',
    AWS_SQS_URL: 'https://sqs.example/queue',
  };
  let send: jest.Mock;
  let service: SqsService;

  const count = (n: number) => ({
    Attributes: { ApproximateNumberOfMessages: String(n) },
  });
  const received = {
    Messages: [
      { MessageId: 'm1', ReceiptHandle: 'r1', Body: JSON.stringify({ id: 1 }) },
      { MessageId: 'm2', ReceiptHandle: 'r2', Body: JSON.stringify({ id: 2 }) },
    ],
  };

  beforeEach(() => {
    send = jest.fn();
    service = new SqsService({ send } as unknown as SQSClient, config);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  const commands = () =>
    send.mock.calls.map(([command]) => command.constructor);

  describe('processMessageBatches', () => {
    it('passes each parsed batch to the handler before deleting it', async () => {
      send
        .mockResolvedValueOnce(count(2))
        .mockResolvedValueOnce(count(2))
        .mockResolvedValueOnce(received)
        .mockResolvedValueOnce({});
      const handler = jest.fn().mockImplementation(async () => {
        expect(commands()).not.toContain(DeleteMessageBatchCommand);
      });

      await service.processMessageBatches(1, handler);

      expect(handler).toHaveBeenCalledWith([{ id: 1 }, { id: 2 }]);
      expect(commands()).toEqual([
        GetQueueAttributesCommand,
        GetQueueAttributesCommand,
        ReceiveMessageCommand,
        DeleteMessageBatchCommand,
      ]);
      expect(send.mock.calls[3][0].input.Entries).toEqual([
        { ReceiptHandle: 'r1', Id: 'm1' },
        { ReceiptHandle: 'r2', Id: 'm2' },
      ]);
    });

    it('does not delete a batch whose handler throws', async () => {
      send
        .mockResolvedValueOnce(count(2))
        .mockResolvedValueOnce(count(2))
        .mockResolvedValueOnce(received);
      const handler = jest.fn().mockRejectedValue(new Error('boom'));

      await service.processMessageBatches(1, handler);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(commands()).not.toContain(DeleteMessageBatchCommand);
    });

    it('deletes received messages when no handler is given', async () => {
      send
        .mockResolvedValueOnce(count(2))
        .mockResolvedValueOnce(count(2))
        .mockResolvedValueOnce(received)
        .mockResolvedValueOnce({});

      await service.processMessageBatches(1);

      expect(commands()).toContain(DeleteMessageBatchCommand);
    });

    it('logs entries that DeleteMessageBatch reports as Failed', async () => {
      const Failed = [
        { Id: 'm2', Code: 'ReceiptHandleIsInvalid', SenderFault: true },
      ];
      send
        .mockResolvedValueOnce(count(2))
        .mockResolvedValueOnce(count(2))
        .mockResolvedValueOnce(received)
        .mockResolvedValueOnce({ Successful: [{ Id: 'm1' }], Failed });

      await service.processMessageBatches(1);

      expect(console.error).toHaveBeenCalledWith(
        'Failed to delete 1 of 2 messages:',
        Failed,
      );
      expect(console.log).toHaveBeenCalledWith('Deleted messages:', [
        { ReceiptHandle: 'r1', Id: 'm1' },
      ]);
    });

    it('does not report any message as deleted when every entry fails', async () => {
      const Failed = [
        { Id: 'm1', Code: 'InternalError', SenderFault: false },
        { Id: 'm2', Code: 'InternalError', SenderFault: false },
      ];
      send
        .mockResolvedValueOnce(count(2))
        .mockResolvedValueOnce(count(2))
        .mockResolvedValueOnce(received)
        .mockResolvedValueOnce({ Failed });

      await service.processMessageBatches(1);

      expect(console.error).toHaveBeenCalledWith(
        'Failed to delete 2 of 2 messages:',
        Failed,
      );
      expect(
        (console.log as jest.Mock).mock.calls.filter(
          ([m]) => m === 'Deleted messages:',
        ),
      ).toHaveLength(0);
    });

    it('does nothing when the queue is empty', async () => {
      send.mockResolvedValueOnce(count(0));
      const handler = jest.fn();

      await service.processMessageBatches(5, handler);

      expect(handler).not.toHaveBeenCalled();
      expect(commands()).toEqual([GetQueueAttributesCommand]);
    });
  });

  describe('publish', () => {
    it('sends the JSON-serialised event to the configured queue', async () => {
      send.mockResolvedValue({});

      await service.publish({ id: 1, tags: ['a'] });

      const [command] = send.mock.calls[0];
      expect(command).toBeInstanceOf(SendMessageCommand);
      expect(command.input).toEqual({
        MessageBody: JSON.stringify({ id: 1, tags: ['a'] }),
        QueueUrl: config.AWS_SQS_URL,
      });
    });

    it('logs and rethrows send failures', async () => {
      const error = new Error('throttled');
      send.mockRejectedValue(error);

      await expect(service.publish({})).rejects.toBe(error);
      expect(console.error).toHaveBeenCalledWith(
        'Error sending data to SQS:',
        error,
      );
    });
  });

  describe('verifyQueue', () => {
    it('requests the QueueArn and resolves true', async () => {
      send.mockResolvedValue({ Attributes: { QueueArn: 'arn' } });

      await expect(service.verifyQueue()).resolves.toBe(true);
      expect(send.mock.calls[0][0].input).toEqual({
        QueueUrl: config.AWS_SQS_URL,
        AttributeNames: ['QueueArn'],
      });
    });

    it.each([
      [
        'AWS.SimpleQueueService.NonExistentQueue',
        ['Queue does not exist:', config.AWS_SQS_URL],
      ],
      [
        'AccessDeniedException',
        ['Permission denied. Check IAM roles/policies'],
      ],
      ['SomethingElse', ['Queue verification failed:', 'nope']],
    ])('logs a %s error and rethrows it', async (name, logged) => {
      const error = Object.assign(new Error('nope'), { name });
      send.mockRejectedValue(error);

      await expect(service.verifyQueue()).rejects.toBe(error);
      expect(console.error).toHaveBeenCalledWith(...logged);
    });
  });

  describe('getApproximateNumberOfMessages', () => {
    it('parses the attribute as a number', async () => {
      send.mockResolvedValue(count(42));

      await expect(service.getApproximateNumberOfMessages()).resolves.toBe(42);
      expect(send.mock.calls[0][0].input).toEqual({
        QueueUrl: config.AWS_SQS_URL,
        AttributeNames: ['ApproximateNumberOfMessages'],
      });
    });

    it.each([[{}], [{ Attributes: {} }]])(
      'returns 0 when the attribute is missing (%j)',
      async (response) => {
        send.mockResolvedValue(response);

        await expect(service.getApproximateNumberOfMessages()).resolves.toBe(0);
      },
    );

    it('logs and rethrows failures', async () => {
      const error = new Error('denied');
      send.mockRejectedValue(error);

      await expect(service.getApproximateNumberOfMessages()).rejects.toBe(
        error,
      );
      expect(console.error).toHaveBeenCalledWith({
        error,
        detail: `Failed to determine ApproximateNumberOfMessages for queue ${config.AWS_SQS_URL}:`,
      });
    });
  });

  describe('processMessageBatches (iteration)', () => {
    it('stops after maxIterations even when messages remain', async () => {
      send.mockImplementation(async (command) => {
        if (command instanceof GetQueueAttributesCommand) return count(100);
        if (command instanceof ReceiveMessageCommand) return received;
        return {};
      });
      const handler = jest.fn();

      await service.processMessageBatches(3, handler);

      expect(handler).toHaveBeenCalledTimes(3);
      expect(
        commands().filter((c) => c === DeleteMessageBatchCommand),
      ).toHaveLength(3);
    });

    it('long-polls for up to 10 messages', async () => {
      send
        .mockResolvedValueOnce(count(1))
        .mockResolvedValueOnce(count(1))
        .mockResolvedValueOnce({});

      await service.processMessageBatches(1);

      expect(send.mock.calls[2][0].input).toEqual({
        QueueUrl: config.AWS_SQS_URL,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 20,
        VisibilityTimeout: 30,
      });
    });

    it('stops once the refreshed count reaches zero', async () => {
      send
        .mockResolvedValueOnce(count(2))
        .mockResolvedValueOnce(count(0))
        .mockResolvedValueOnce({ Messages: [] });
      const handler = jest.fn();

      await service.processMessageBatches(5, handler);

      expect(handler).not.toHaveBeenCalled();
      expect(commands()).toEqual([
        GetQueueAttributesCommand,
        GetQueueAttributesCommand,
        ReceiveMessageCommand,
      ]);
    });

    it('parses a message without a Body as an empty object', async () => {
      send
        .mockResolvedValueOnce(count(1))
        .mockResolvedValueOnce(count(1))
        .mockResolvedValueOnce({
          Messages: [{ MessageId: 'm', ReceiptHandle: 'r' }],
        })
        .mockResolvedValueOnce({});
      const handler = jest.fn();

      await service.processMessageBatches(1, handler);

      expect(handler).toHaveBeenCalledWith([{}]);
    });

    it('logs receive errors and keeps iterating', async () => {
      const error = new Error('receive failed');
      send.mockImplementation(async (command) => {
        if (command instanceof GetQueueAttributesCommand) return count(1);
        throw error;
      });

      await service.processMessageBatches(2);

      expect(console.error).toHaveBeenCalledWith(
        'Error polling messages:',
        error,
      );
      expect(
        commands().filter((c) => c === ReceiveMessageCommand),
      ).toHaveLength(2);
    });

    it('propagates a failure of the initial count', async () => {
      const error = new Error('denied');
      send.mockRejectedValue(error);

      await expect(service.processMessageBatches(1)).rejects.toBe(error);
    });
  });
});
