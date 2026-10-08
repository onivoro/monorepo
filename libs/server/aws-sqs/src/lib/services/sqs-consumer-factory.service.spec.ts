import { SQSClient } from '@aws-sdk/client-sqs';
import { SqsConsumerFactoryService } from './sqs-consumer-factory.service';
import { SqsConsumerService } from './sqs-consumer.service';

describe(SqsConsumerFactoryService.name, () => {
  it('creates a consumer bound to the shared client, handler and config', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const send = jest.fn().mockResolvedValue({
      Messages: [{ MessageId: 'm', ReceiptHandle: 'r', Body: '{"a":1}' }],
    });
    const handler = { handleMessage: jest.fn().mockResolvedValue(undefined) };
    const factory = new SqsConsumerFactoryService({
      send,
    } as unknown as SQSClient);

    const consumer = factory.createConsumer(
      { queueUrl: 'https://sqs.example/123/orders', maxMessages: 5 },
      handler,
    );

    expect(consumer).toBeInstanceOf(SqsConsumerService);
    await expect(consumer.getQueueStats()).resolves.toMatchObject({
      queueName: 'orders',
      config: { maxMessages: 5 },
    });
    await consumer.processQueueManually();
    expect(send.mock.calls[0][0].input.QueueUrl).toBe(
      'https://sqs.example/123/orders',
    );
    expect(handler.handleMessage).toHaveBeenCalledWith({ a: 1 }, {});
    jest.restoreAllMocks();
  });
});
