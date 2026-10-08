# @onivoro/server-aws-firehose

AWS Kinesis Data Firehose integration for NestJS applications: write JSON records to a delivery stream.

## Installation

```bash
npm install @onivoro/server-aws-firehose @aws-sdk/client-firehose @nestjs/common
```

`@aws-sdk/client-firehose` and `@nestjs/common` are peer dependencies. (`@aws-sdk/s3-request-presigner` is also listed as a peer dependency but is not used by this package.)

## Module Setup

`ServerAwsFirehoseModule.configure(config)` takes the configuration object directly; the module does not read environment variables itself.

```typescript
import { Module } from '@nestjs/common';
import { ServerAwsFirehoseModule } from '@onivoro/server-aws-firehose';

@Module({
  imports: [
    ServerAwsFirehoseModule.configure({
      AWS_REGION: process.env.AWS_REGION!,
      AWS_FIREHOSE_NAME: process.env.AWS_FIREHOSE_NAME!,
      AWS_PROFILE: process.env.AWS_PROFILE, // optional
    }),
  ],
})
export class AppModule {}
```

The module is not global. It provides and exports `FirehoseService`, `ServerAwsFirehoseConfig`, a `FirehoseClient` instance, and the `AwsCredentials` provider from `@onivoro/server-aws-credential-providers`.

## Configuration

```typescript
export class ServerAwsFirehoseConfig {
  AWS_FIREHOSE_NAME: string; // delivery stream that putRecord writes to
  AWS_PROFILE?: string; // optional named profile from ~/.aws
  AWS_REGION: string;
}
```

### AWS Credentials

Credentials are resolved by [`@onivoro/server-aws-credential-providers`](../aws-credential-providers/):

- If `AWS_PROFILE` is set, credentials are loaded from that profile in the shared credentials file. If that fails, `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` (or their lowercase forms) from the environment are used.
- If `AWS_PROFILE` is not set, the client uses the AWS SDK's default credential provider chain.

## FirehoseService

### `putRecord(data: any, eventId: string): Promise<void>`

Serializes `data` with `JSON.stringify`, appends a newline (`\n`) so records are line-delimited in the destination, and sends a `PutRecordCommand` to the `AWS_FIREHOSE_NAME` delivery stream. On failure the error is logged with `console.error` and rethrown.

The `eventId` argument is required by the signature but is currently not used.

```typescript
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { FirehoseService } from '@onivoro/server-aws-firehose';

@Injectable()
export class AuditLogService {
  constructor(private readonly firehoseService: FirehoseService) {}

  async record(userId: string, action: string) {
    const eventId = randomUUID();

    await this.firehoseService.putRecord({ eventId, userId, action, timestamp: new Date().toISOString() }, eventId);
  }
}
```

## Direct Client Access

The service keeps its client private, but the module exports the `FirehoseClient` provider, so you can inject it for operations the service doesn't cover:

```typescript
import { Injectable } from '@nestjs/common';
import { FirehoseClient, PutRecordBatchCommand } from '@aws-sdk/client-firehose';
import { ServerAwsFirehoseConfig } from '@onivoro/server-aws-firehose';

@Injectable()
export class BatchAuditLogService {
  constructor(
    private readonly firehoseClient: FirehoseClient,
    private readonly config: ServerAwsFirehoseConfig,
  ) {}

  async recordMany(events: object[]) {
    return this.firehoseClient.send(
      new PutRecordBatchCommand({
        DeliveryStreamName: this.config.AWS_FIREHOSE_NAME,
        Records: events.map((e) => ({ Data: Buffer.from(JSON.stringify(e) + '\n') })),
      }),
    );
  }
}
```

## Exports

- `ServerAwsFirehoseModule` - dynamic module with `configure(config)`
- `ServerAwsFirehoseConfig` - configuration class (also injectable)
- `FirehoseService` - `putRecord(data, eventId)`

## License

MIT
