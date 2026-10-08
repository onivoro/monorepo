import {
  DeleteMessageBatchCommand,
  DeleteMessageCommand,
  Message,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { MessageHandler, SqsConsumerService } from './sqs-consumer.service';

describe(SqsConsumerService.name, () => {
  const queueUrl = 'https://sqs.us-east-1.amazonaws.com/123/orders';
  let send: jest.Mock;
  let handler: MessageHandler & { handleMessage: jest.Mock };

  const message = (id: string, body?: string, extra: Partial<Message> = {}) =>
    ({
      MessageId: id,
      ReceiptHandle: `rh-${id}`,
      Body: body,
      ...extra,
    }) as Message;

  const create = (
    config: Partial<ConstructorParameters<typeof SqsConsumerService>[2]> = {},
  ) =>
    new SqsConsumerService({ send } as unknown as SQSClient, handler, {
      queueUrl,
      ...config,
    });

  const sentOf = (type: Function) =>
    send.mock.calls.map(([c]) => c).filter((c) => c instanceof type);

  beforeEach(() => {
    send = jest.fn();
    handler = { handleMessage: jest.fn().mockResolvedValue(undefined) };
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('getQueueStats', () => {
    it('reports defaults and the queue name from the URL', async () => {
      await expect(create().getQueueStats()).resolves.toEqual({
        queueUrl,
        queueName: 'orders',
        isPolling: false,
        config: {
          maxMessages: 10,
          visibilityTimeout: 300,
          waitTimeSeconds: 20,
        },
      });
    });

    it('reports overridden config', async () => {
      const stats = await create({
        maxMessages: 3,
        visibilityTimeout: 60,
        waitTimeSeconds: 0,
      }).getQueueStats();

      expect(stats.config).toEqual({
        maxMessages: 3,
        visibilityTimeout: 60,
        waitTimeSeconds: 0,
      });
    });

    it("falls back to 'unknown-queue' when the URL has no trailing name", async () => {
      const consumer = new SqsConsumerService(
        { send } as unknown as SQSClient,
        handler,
        { queueUrl: 'https://sqs.example/123/' },
      );

      await expect(consumer.getQueueStats()).resolves.toMatchObject({
        queueName: 'unknown-queue',
      });
    });
  });

  describe('processQueueManually', () => {
    it('receives with the configured options', async () => {
      send.mockResolvedValue({});

      await create({
        maxMessages: 4,
        waitTimeSeconds: 5,
        visibilityTimeout: 45,
      }).processQueueManually();

      const [receive] = sentOf(ReceiveMessageCommand);
      expect(receive.input).toEqual({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 4,
        WaitTimeSeconds: 5,
        VisibilityTimeout: 45,
        MessageAttributeNames: ['All'],
        AttributeNames: ['All'],
      });
      expect(handler.handleMessage).not.toHaveBeenCalled();
      expect(send).toHaveBeenCalledTimes(1);
    });

    it('hands the parsed body and string attributes to the handler, then deletes the message', async () => {
      send.mockResolvedValueOnce({
        Messages: [
          message('m1', '{"orderId":7}', {
            MessageAttributes: {
              tenant: { DataType: 'String', StringValue: 'acme' },
              count: { DataType: 'Number', StringValue: '3' },
            },
          }),
        ],
      });
      send.mockResolvedValueOnce({});

      await create().processQueueManually();

      expect(handler.handleMessage).toHaveBeenCalledWith(
        { orderId: 7 },
        { tenant: 'acme', count: '3' },
      );
      const [del] = sentOf(DeleteMessageCommand);
      expect(del.input).toEqual({ QueueUrl: queueUrl, ReceiptHandle: 'rh-m1' });
      expect(sentOf(DeleteMessageBatchCommand)).toHaveLength(0);
    });

    it('batch-deletes when several messages succeed', async () => {
      send.mockResolvedValueOnce({
        Messages: [message('a', '1'), message('b', '2'), message('c', '3')],
      });
      send.mockResolvedValueOnce({});

      await create().processQueueManually();

      expect(handler.handleMessage.mock.calls.map(([body]) => body)).toEqual([
        1, 2, 3,
      ]);
      const [batch] = sentOf(DeleteMessageBatchCommand);
      expect(batch.input).toEqual({
        QueueUrl: queueUrl,
        Entries: [
          { Id: '0', ReceiptHandle: 'rh-a' },
          { Id: '1', ReceiptHandle: 'rh-b' },
          { Id: '2', ReceiptHandle: 'rh-c' },
        ],
      });
    });

    it('deletes only the messages that were processed successfully', async () => {
      send.mockResolvedValueOnce({
        Messages: [
          message('ok-1', '{"n":1}'),
          message('empty', undefined),
          message('bad-json', '{nope'),
          message('handler-fails', '{"n":4}'),
          message('ok-2', '{"n":5}'),
        ],
      });
      send.mockResolvedValueOnce({});
      handler.handleMessage.mockImplementation(async (body) => {
        if (body.n === 4) throw new Error('handler failed');
      });

      await create().processQueueManually();

      expect(handler.handleMessage).toHaveBeenCalledTimes(3);
      const [batch] = sentOf(DeleteMessageBatchCommand);
      expect(batch.input.Entries.map((e: any) => e.ReceiptHandle)).toEqual([
        'rh-ok-1',
        'rh-ok-2',
      ]);
      const errors = (console.error as jest.Mock).mock.calls;
      expect(errors).toContainEqual([
        'Failed to process message empty from orders:',
        new Error('Message body is empty'),
      ]);
      expect(
        errors.find(
          ([m]) => m === 'Failed to process message bad-json from orders:',
        )?.[1].message,
      ).toMatch(/^Failed to parse message body: SyntaxError/);
      expect(errors).toContainEqual([
        'Failed to process 3 messages from orders. They will be retried.',
      ]);
    });

    it('deletes nothing when every message fails', async () => {
      send.mockResolvedValueOnce({ Messages: [message('x', undefined)] });

      await create().processQueueManually();

      expect(send).toHaveBeenCalledTimes(1);
    });

    it('logs messages that DeleteMessageBatch reports as Failed instead of counting them as deleted', async () => {
      send.mockResolvedValueOnce({
        Messages: [message('a', '1'), message('b', '2'), message('c', '3')],
      });
      send.mockResolvedValueOnce({
        Successful: [{ Id: '0' }, { Id: '2' }],
        Failed: [
          {
            Id: '1',
            Code: 'ReceiptHandleIsInvalid',
            Message: 'expired',
            SenderFault: true,
          },
        ],
      });

      await expect(create().processQueueManually()).resolves.toBeUndefined();

      expect(console.error).toHaveBeenCalledWith(
        'Failed to delete 1 of 3 processed messages from orders. They will be redelivered:',
        [
          {
            MessageId: 'b',
            Code: 'ReceiptHandleIsInvalid',
            Message: 'expired',
            SenderFault: true,
          },
        ],
      );
      expect(console.log).toHaveBeenCalledWith(
        'Successfully deleted 2 processed messages from orders',
      );
      expect(console.log).not.toHaveBeenCalledWith(
        'Successfully deleted 3 processed messages from orders',
      );
    });

    it('logs no success when every batch entry fails to delete', async () => {
      send.mockResolvedValueOnce({
        Messages: [message('a', '1'), message('b', '2')],
      });
      send.mockResolvedValueOnce({
        Failed: [
          { Id: '0', Code: 'InternalError', SenderFault: false },
          { Id: '1', Code: 'InternalError', SenderFault: false },
        ],
      });

      await create().processQueueManually();

      expect(console.error).toHaveBeenCalledWith(
        'Failed to delete 2 of 2 processed messages from orders. They will be redelivered:',
        [
          { MessageId: 'a', Code: 'InternalError', SenderFault: false },
          { MessageId: 'b', Code: 'InternalError', SenderFault: false },
        ],
      );
      expect(
        (console.log as jest.Mock).mock.calls.filter(([m]) =>
          String(m).startsWith('Successfully deleted'),
        ),
      ).toHaveLength(0);
    });

    it('swallows delete failures', async () => {
      const error = new Error('delete failed');
      send.mockResolvedValueOnce({ Messages: [message('m', '{}')] });
      send.mockRejectedValueOnce(error);

      await expect(create().processQueueManually()).resolves.toBeUndefined();
      expect(console.error).toHaveBeenCalledWith(
        'Error deleting messages from orders:',
        error,
      );
    });

    it('logs and rethrows receive failures', async () => {
      const error = new Error('receive failed');
      send.mockRejectedValue(error);

      await expect(create().processQueueManually()).rejects.toBe(error);
      expect(console.error).toHaveBeenCalledWith(
        'Error polling messages from orders:',
        error,
      );
    });
  });

  describe('startPolling / stopPolling', () => {
    beforeEach(() => jest.useFakeTimers());

    const receives = () => sentOf(ReceiveMessageCommand).length;

    it('waits emptyQueueDelayMs between polls of an empty queue', async () => {
      send.mockResolvedValue({});
      const consumer = create({ emptyQueueDelayMs: 200 });

      await consumer.startPolling();
      await jest.advanceTimersByTimeAsync(0);
      expect(receives()).toBe(1);
      await expect(consumer.getQueueStats()).resolves.toMatchObject({
        isPolling: true,
      });

      await jest.advanceTimersByTimeAsync(199);
      expect(receives()).toBe(1);
      await jest.advanceTimersByTimeAsync(1);
      expect(receives()).toBe(2);

      const stopped = consumer.stopPolling();
      await jest.advanceTimersByTimeAsync(200);
      await stopped;
      expect(receives()).toBe(2);
      await expect(consumer.getQueueStats()).resolves.toMatchObject({
        isPolling: false,
      });
    });

    it('polls again immediately after a full batch', async () => {
      const full = { Messages: [message('a', '1'), message('b', '2')] };
      send.mockImplementation(async (command) => {
        if (command instanceof ReceiveMessageCommand)
          return receives() === 1 ? full : {};
        return {};
      });
      const consumer = create({ maxMessages: 2, emptyQueueDelayMs: 1000 });

      await consumer.startPolling();
      await jest.advanceTimersByTimeAsync(0);

      expect(receives()).toBe(2);
      expect(handler.handleMessage).toHaveBeenCalledTimes(2);
      expect(console.log).toHaveBeenCalledWith(
        'Queue orders may have more messages, polling again immediately...',
      );

      const stopped = consumer.stopPolling();
      await jest.advanceTimersByTimeAsync(1000);
      await stopped;
    });

    it('polls again immediately after a partial batch', async () => {
      send.mockImplementation(async (command) => {
        if (command instanceof ReceiveMessageCommand)
          return receives() === 1 ? { Messages: [message('a', '1')] } : {};
        return {};
      });
      const consumer = create({ maxMessages: 10, emptyQueueDelayMs: 1000 });

      await consumer.startPolling();
      await jest.advanceTimersByTimeAsync(0);

      expect(receives()).toBe(2);

      const stopped = consumer.stopPolling();
      await jest.advanceTimersByTimeAsync(1000);
      await stopped;
    });

    it('backs off errorDelayMs after a receive error', async () => {
      const error = new Error('throttled');
      send.mockRejectedValueOnce(error).mockResolvedValue({});
      const consumer = create({ errorDelayMs: 3000, emptyQueueDelayMs: 10 });

      await consumer.startPolling();
      await jest.advanceTimersByTimeAsync(2999);
      expect(receives()).toBe(1);
      expect(console.error).toHaveBeenCalledWith(
        'Error in polling loop for orders:',
        error,
      );
      await jest.advanceTimersByTimeAsync(1);
      expect(receives()).toBe(2);

      const stopped = consumer.stopPolling();
      await jest.advanceTimersByTimeAsync(10);
      await stopped;
    });

    it('ignores a second startPolling while already polling', async () => {
      send.mockResolvedValue({});
      const consumer = create({ emptyQueueDelayMs: 100 });

      await consumer.startPolling();
      await consumer.startPolling();
      await jest.advanceTimersByTimeAsync(0);

      expect(console.log).toHaveBeenCalledWith(
        'Queue consumer is already polling',
      );
      expect(receives()).toBe(1);

      const stopped = consumer.stopPolling();
      await jest.advanceTimersByTimeAsync(100);
      await stopped;
    });

    it('can be restarted after stopping', async () => {
      send.mockResolvedValue({});
      const consumer = create({ emptyQueueDelayMs: 100 });

      await consumer.startPolling();
      let stopped = consumer.stopPolling();
      await jest.advanceTimersByTimeAsync(100);
      await stopped;
      const afterFirstRun = receives();

      await consumer.startPolling();
      await jest.advanceTimersByTimeAsync(0);
      expect(receives()).toBe(afterFirstRun + 1);

      stopped = consumer.stopPolling();
      await jest.advanceTimersByTimeAsync(100);
      await stopped;
    });

    it('stopPolling resolves when polling was never started', async () => {
      await expect(create().stopPolling()).resolves.toBeUndefined();
      expect(console.log).toHaveBeenCalledWith(
        'Queue consumer stopped for orders',
      );
      expect(send).not.toHaveBeenCalled();
    });
  });
});
