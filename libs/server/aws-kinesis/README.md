# @onivoro/server-aws-kinesis

AWS Kinesis Data Streams integration for NestJS applications.

## Installation

```bash
npm install @onivoro/server-aws-kinesis
```

## Overview

This library provides a simple AWS Kinesis Data Streams integration for NestJS applications, allowing you to publish data to Kinesis streams.

## Module Setup

```typescript
import { Module } from '@nestjs/common';
import { ServerAwsKinesisModule } from '@onivoro/server-aws-kinesis';

@Module({
  imports: [
    ServerAwsKinesisModule.configure()
  ]
})
export class AppModule {}
```

## Configuration

The module uses environment-based configuration:

```typescript
export class ServerAwsKinesisConfig {
  AWS_REGION: string;
  AWS_PROFILE?: string;  // Optional AWS profile
}
```

## Service

### KinesisService

The main service for publishing data to Kinesis streams:

```typescript
import { Injectable } from '@nestjs/common';
import { KinesisService } from '@onivoro/server-aws-kinesis';

@Injectable()
export class EventPublisherService {
  constructor(private readonly kinesisService: KinesisService) {}

  async publishEvent(streamName: string, eventData: any) {
    const result = await this.kinesisService.publish({
      streamName,
      data: eventData,
      partitionKey: eventData.id || 'default'
    });
    
    return result;
  }

  async publishUserActivity(userId: string, activity: any) {
    const streamName = 'user-activity-stream';
    const data = {
      userId,
      activity,
      timestamp: new Date().toISOString()
    };
    
    return await this.kinesisService.publish({
      streamName,
      data,
      partitionKey: userId  // Use userId as partition key for ordering
    });
  }
}
```

## Method Details

### publish(params)

The `publish` method accepts an object with the following properties:

- **streamName** (string, required): The name of the Kinesis stream
- **data** (any, required): The data to publish (will be JSON stringified)
- **partitionKey** (string, required): Used to determine which shard to send the record to

## Direct Client Access

The service exposes the underlying Kinesis client for advanced operations:

```typescript
import { 
  DescribeStreamCommand,
  ListStreamsCommand,
  GetRecordsCommand,
  GetShardIteratorCommand,
  CreateStreamCommand
} from '@aws-sdk/client-kinesis';

@Injectable()
export class AdvancedKinesisService {
  constructor(private readonly kinesisService: KinesisService) {}

  // List all Kinesis streams
  async listStreams() {
    const command = new ListStreamsCommand({});
    return await this.kinesisService.kinesisClient.send(command);
  }

  // Describe stream details
  async describeStream(streamName: string) {
    const command = new DescribeStreamCommand({
      StreamName: streamName
    });
    return await this.kinesisService.kinesisClient.send(command);
  }

  // Create a new stream
  async createStream(streamName: string, shardCount: number = 1) {
    const command = new CreateStreamCommand({
      StreamName: streamName,
      ShardCount: shardCount
    });
    return await this.kinesisService.kinesisClient.send(command);
  }
}
```

## Complete Example

```typescript
import { Module, Injectable } from '@nestjs/common';
import { ServerAwsKinesisModule, KinesisService } from '@onivoro/server-aws-kinesis';

@Module({
  imports: [ServerAwsKinesisModule.configure()],
  providers: [OrderEventService],
  exports: [OrderEventService]
})
export class OrderModule {}

@Injectable()
export class OrderEventService {
  constructor(private readonly kinesisService: KinesisService) {}

  async publishOrderEvent(orderId: string, eventType: string, eventData: any) {
    const streamName = 'order-events-stream';
    
    const event = {
      orderId,
      eventType,
      eventData,
      timestamp: new Date().toISOString(),
      version: '1.0'
    };

    try {
      const result = await this.kinesisService.publish({
        streamName,
        data: event,
        partitionKey: orderId
      });

      console.log(`Published ${eventType} event for order ${orderId}:`, {
        shardId: result.ShardId,
        sequenceNumber: result.SequenceNumber
      });

      return result;
    } catch (error) {
      console.error(`Failed to publish event for order ${orderId}:`, error);
      throw error;
    }
  }

  // Publish different order events
  async orderCreated(order: any) {
    return this.publishOrderEvent(order.id, 'ORDER_CREATED', order);
  }

  async orderUpdated(orderId: string, updates: any) {
    return this.publishOrderEvent(orderId, 'ORDER_UPDATED', updates);
  }

  async orderShipped(orderId: string, trackingInfo: any) {
    return this.publishOrderEvent(orderId, 'ORDER_SHIPPED', trackingInfo);
  }

  async orderDelivered(orderId: string, deliveryInfo: any) {
    return this.publishOrderEvent(orderId, 'ORDER_DELIVERED', deliveryInfo);
  }
}
```

## Batch Publishing Example

For better performance with multiple records:

```typescript
@Injectable()
export class BatchEventService {
  constructor(private readonly kinesisService: KinesisService) {}

  async publishBatch(streamName: string, events: any[]) {
    // Use the exposed client for batch operations
    const records = events.map(event => ({
      Data: Buffer.from(JSON.stringify(event.data)),
      PartitionKey: event.partitionKey
    }));

    const command = new PutRecordsCommand({
      StreamName: streamName,
      Records: records
    });

    return await this.kinesisService.kinesisClient.send(command);
  }
}
```

## Environment Variables

```bash
# Required: AWS region
AWS_REGION=us-east-1

# Optional: AWS profile
AWS_PROFILE=my-profile
```

## AWS Credentials

The module uses the standard AWS SDK credential chain:
1. Environment variables
2. Shared credentials file
3. IAM roles (for EC2/ECS/Lambda)

## Error Handling

```typescript
try {
  await kinesisService.publish({
    streamName: 'my-stream',
    data: eventData,
    partitionKey: 'key'
  });
} catch (error) {
  if (error.name === 'ResourceNotFoundException') {
    console.error('Kinesis stream does not exist');
  } else if (error.name === 'ProvisionedThroughputExceededException') {
    console.error('Rate limit exceeded, implement retry logic');
  }
}
```

## Limitations

- This library only provides a single `publish` method
- No built-in support for batch publishing or consumer operations
- For advanced Kinesis operations, use the exposed `kinesisClient` directly
- No automatic retry logic for throughput exceptions

## Best Practices

1. **Partition Key Selection**: Choose partition keys that evenly distribute data across shards
2. **Data Size**: Keep record size under 1 MB (Kinesis limit)
3. **Error Handling**: Implement retry logic for transient errors
4. **Monitoring**: Use CloudWatch metrics to monitor stream performance
5. **Scaling**: Monitor shard metrics and scale as needed

## License

MIT