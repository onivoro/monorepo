# @onivoro/server-aws-kinesis

AWS Kinesis Data Streams integration for NestJS applications: publish JSON records to a stream.

## Installation

```bash
npm install @onivoro/server-aws-kinesis @aws-sdk/client-kinesis @nestjs/common
```

`@aws-sdk/client-kinesis` and `@nestjs/common` are peer dependencies.

## Module Setup

`ServerAwsKinesisModule.configure(config)` takes the configuration object directly; the module does not read environment variables itself.

```typescript
import { Module } from '@nestjs/common';
import { ServerAwsKinesisModule } from '@onivoro/server-aws-kinesis';

@Module({
  imports: [
    ServerAwsKinesisModule.configure({
      AWS_REGION: process.env.AWS_REGION!,
      AWS_KINESIS_NAME: process.env.AWS_KINESIS_NAME!,
      AWS_PROFILE: process.env.AWS_PROFILE, // optional
    }),
  ],
})
export class AppModule {}
```

The module is not global. It provides and exports `KinesisService`, `ServerAwsKinesisConfig`, a `KinesisClient` instance, and the `AwsCredentials` provider from `@onivoro/server-aws-credential-providers`.

## Configuration

```typescript
export class ServerAwsKinesisConfig {
  AWS_KINESIS_NAME: string; // stream that publish writes to
  AWS_PROFILE?: string; // optional named profile from ~/.aws
  AWS_REGION: string;
}
```

### AWS Credentials

Credentials are resolved by [`@onivoro/server-aws-credential-providers`](../aws-credential-providers/):

- If `AWS_PROFILE` is set, credentials are loaded from that profile in the shared credentials file. If that fails, `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` (or their lowercase forms) from the environment are used.
- If `AWS_PROFILE` is not set, the client uses the AWS SDK's default credential provider chain.

## KinesisService

### `publish<TData>(event: TData, PartitionKey: string): Promise<void>`

Sends a `PutRecordCommand` to the `AWS_KINESIS_NAME` stream with `Data` set to `JSON.stringify(event)` and the given partition key. The stream name always comes from config.

Errors are caught and logged with `console.error`; `publish` never rejects and does not return the `PutRecord` response (shard ID / sequence number).

```typescript
import { Injectable } from '@nestjs/common';
import { KinesisService } from '@onivoro/server-aws-kinesis';

interface OrderEvent {
  orderId: string;
  type: 'ORDER_CREATED' | 'ORDER_SHIPPED';
  timestamp: string;
}

@Injectable()
export class OrderEventPublisher {
  constructor(private readonly kinesisService: KinesisService) {}

  async orderCreated(orderId: string) {
    // Using orderId as the partition key keeps an order's events on one shard, in order.
    await this.kinesisService.publish<OrderEvent>({ orderId, type: 'ORDER_CREATED', timestamp: new Date().toISOString() }, orderId);
  }
}
```

## Direct Client Access

The service keeps its client private, but the module exports the `KinesisClient` provider. Inject it for anything `publish` doesn't cover, such as batching or when you need errors to propagate:

```typescript
import { Injectable } from '@nestjs/common';
import { KinesisClient, PutRecordsCommand } from '@aws-sdk/client-kinesis';
import { ServerAwsKinesisConfig } from '@onivoro/server-aws-kinesis';

@Injectable()
export class BatchEventPublisher {
  constructor(
    private readonly kinesis: KinesisClient,
    private readonly config: ServerAwsKinesisConfig,
  ) {}

  publishBatch(events: { partitionKey: string; data: unknown }[]) {
    return this.kinesis.send(
      new PutRecordsCommand({
        StreamName: this.config.AWS_KINESIS_NAME,
        Records: events.map((e) => ({
          Data: Buffer.from(JSON.stringify(e.data)),
          PartitionKey: e.partitionKey,
        })),
      }),
    );
  }
}
```

## Exports

- `ServerAwsKinesisModule` - dynamic module with `configure(config)`
- `ServerAwsKinesisConfig` - configuration class (also injectable)
- `KinesisService` - `publish(event, partitionKey)`

## License

MIT
