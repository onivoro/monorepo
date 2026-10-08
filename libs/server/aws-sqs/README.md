# @onivoro/server-aws-sqs

A NestJS module for AWS SQS using AWS SDK v3: publish JSON messages, inspect a queue, and run long-polling consumers that hand each message to your handler.

## Installation

```bash
npm install @onivoro/server-aws-sqs @aws-sdk/client-sqs
```

`@nestjs/common` is also a peer dependency.

## Module Configuration

```typescript
import { Module } from '@nestjs/common';
import { ServerAwsSqsModule } from '@onivoro/server-aws-sqs';

@Module({
  imports: [
    ServerAwsSqsModule.configure({
      AWS_REGION: 'us-east-1',
      AWS_SQS_URL: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue',
      AWS_PROFILE: process.env.AWS_PROFILE, // optional
    }),
  ],
})
export class AppModule {}
```

```typescript
export class ServerAwsSqsConfig {
  AWS_PROFILE?: string;
  AWS_REGION: string;
  AWS_SQS_URL: string; // queue used by SqsService
}
```

`configure()` takes the config object directly; the module does not read environment variables itself. Credentials come from [`@onivoro/server-aws-credential-providers`](../aws-credential-providers/): when `AWS_PROFILE` is set the named profile is used, otherwise the AWS SDK default credential chain applies.

The module provides and exports `SqsService`, `SqsConsumerFactoryService`, an `SQSClient`, and `ServerAwsSqsConfig`.

## SqsService

Works against the queue in `AWS_SQS_URL`.

```typescript
import { Injectable } from '@nestjs/common';
import { SqsService } from '@onivoro/server-aws-sqs';

@Injectable()
export class EventPublisher {
  constructor(private readonly sqs: SqsService) {}

  userCreated(userId: string) {
    return this.sqs.publish({ type: 'USER_CREATED', userId, timestamp: new Date().toISOString() });
  }

  async health() {
    const accessible = await this.sqs.verifyQueue().catch(() => false);
    const backlog = await this.sqs.getApproximateNumberOfMessages().catch(() => -1);
    return { accessible, backlog };
  }
}
```

- **`publish<TData>(event: TData): Promise<void>`**: sends `JSON.stringify(event)` with `SendMessageCommand`. Errors are logged and rethrown.
- **`verifyQueue(): Promise<boolean>`**: calls `GetQueueAttributesCommand` for `QueueArn`; returns `true` on success. Logs a specific message for `AWS.SimpleQueueService.NonExistentQueue` and `AccessDeniedException`, then rethrows any error.
- **`getApproximateNumberOfMessages(): Promise<number>`**: reads `ApproximateNumberOfMessages` (`0` if absent). Errors are logged and rethrown.
- **`processMessageBatches<TData = any>(maxIterations: number, handler?: (messages: TData[]) => Promise<void> | void): Promise<void>`**: while the approximate count is non-zero and fewer than `maxIterations` iterations have run, it receives up to 10 messages (`WaitTimeSeconds: 20`, `VisibilityTimeout: 30`), parses each body as JSON (an empty body becomes `{}`), passes the parsed batch to `handler`, and then deletes the whole batch with `DeleteMessageBatchCommand`. Entries the batch delete reports in `Failed` are logged with `console.error` (those messages reappear after the visibility timeout), and only the entries that were deleted are logged as deleted. Without a `handler` it simply drains the queue. Errors in an iteration (a body that is not valid JSON, or a `handler` that throws) are logged, that batch is left undeleted to reappear after the visibility timeout, and the loop continues. For long-running, per-message processing use a consumer (below).

## Consumers

`SqsConsumerFactoryService.createConsumer(config, handler)` returns an `SqsConsumerService` that long-polls any queue URL with the module's `SQSClient`.

```typescript
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MessageHandler, SqsConsumerFactoryService, SqsConsumerService } from '@onivoro/server-aws-sqs';

interface OrderEvent {
  orderId: string;
  status: string;
}

@Injectable()
export class OrderEventsConsumer implements MessageHandler<OrderEvent>, OnModuleInit, OnModuleDestroy {
  private consumer: SqsConsumerService;

  constructor(factory: SqsConsumerFactoryService) {
    this.consumer = factory.createConsumer<OrderEvent>({ queueUrl: process.env.ORDER_EVENTS_QUEUE_URL!, visibilityTimeout: 60 }, this);
  }

  async handleMessage(body: OrderEvent, attributes?: Record<string, any>): Promise<void> {
    // Throwing leaves the message on the queue for redelivery.
    console.log(attributes?.source, body.orderId, body.status);
  }

  onModuleInit() {
    return this.consumer.startPolling();
  }

  onModuleDestroy() {
    return this.consumer.stopPolling();
  }
}
```

`SqsConsumerConfig`:

| Field               | Default  | Notes                             |
| ------------------- | -------- | --------------------------------- |
| `queueUrl`          | required |                                   |
| `maxMessages`       | `10`     | `MaxNumberOfMessages` per receive |
| `visibilityTimeout` | `300`    | seconds                           |
| `waitTimeSeconds`   | `20`     | long-poll wait                    |
| `errorDelayMs`      | `5000`   | pause after a failed receive      |
| `emptyQueueDelayMs` | `1000`   | pause after an empty receive      |

`MessageHandler<T>` has one method: `handleMessage(messageBody: T, messageAttributes?: Record<string, any>): Promise<void>`.

Behavior:

- `startPolling()` starts a background loop and returns immediately; calling it again while polling is a no-op. `stopPolling()` stops the loop and waits for the in-flight receive (up to `waitTimeSeconds`) and processing to finish.
- Each receive requests all message attributes and system attributes. Bodies are parsed with `JSON.parse`; `messageAttributes` maps each attribute name to its `StringValue` only.
- Messages in a batch are handled one at a time. Messages whose handler resolves are deleted (`DeleteMessageCommand` for one, `DeleteMessageBatchCommand` for several). Messages with an empty or non-JSON body, or whose handler throws, are left to reappear after the visibility timeout. Delete errors are logged, not thrown. When `DeleteMessageBatchCommand` reports entries in `Failed`, each one is logged with `console.error` (its `MessageId`, `Code`, `Message` and `SenderFault`), it is left out of the "Successfully deleted" count, and the message is redelivered after the visibility timeout, so handlers should be idempotent.
- When a receive returns exactly `maxMessages` messages the loop polls again immediately.
- `processQueueManually()` runs a single receive-and-process cycle.
- `getQueueStats()` resolves to `{ queueUrl, queueName, isPolling, config: { maxMessages, visibilityTimeout, waitTimeSeconds } }`.

Create consumers through the factory; `SqsConsumerService`'s constructor takes `(sqsClient, messageHandler, config)` and is not resolvable by Nest injection on its own.

## API Reference

- `ServerAwsSqsModule.configure(config: ServerAwsSqsConfig)`
- `ServerAwsSqsConfig`
- `SqsService`: `publish`, `verifyQueue`, `getApproximateNumberOfMessages`, `processMessageBatches`
- `SqsConsumerFactoryService`: `createConsumer<T>(config: SqsConsumerConfig, messageHandler: MessageHandler<T>): SqsConsumerService`
- `SqsConsumerService`: `startPolling`, `stopPolling`, `processQueueManually`, `getQueueStats`
- Types: `SqsConsumerConfig`, `MessageHandler<T>`

## License

This library is licensed under the MIT License. See the LICENSE file in this package for details.
