# @onivoro/server-aws-kinesis

A NestJS module for integrating with AWS Kinesis Data Streams, providing real-time data streaming, event publishing, and stream processing capabilities for your server applications.

## Installation

```bash
npm install @onivoro/server-aws-kinesis
```

## Features

- **Real-time Data Streaming**: Publish data to Kinesis streams in real-time
- **Event Publishing**: Send structured events with partition keys
- **Stream Management**: Create and manage Kinesis data streams
- **Partition Key Strategy**: Intelligent partition key generation for data distribution
- **Error Handling**: Robust error handling for stream operations
- **Batch Publishing**: Support for batch data publishing
- **Consumer Support**: Tools for building Kinesis stream consumers
- **Environment-Based Configuration**: Configurable stream settings per environment

## Quick Start

### 1. Module Configuration

```typescript
import { ServerAwsKinesisModule } from '@onivoro/server-aws-kinesis';

@Module({
  imports: [
    ServerAwsKinesisModule.configure({
      AWS_REGION: 'us-east-1',
      AWS_KINESIS_NAME: process.env.KINESIS_STREAM_NAME,
      AWS_PROFILE: process.env.AWS_PROFILE || 'default',
    }),
  ],
})
export class AppModule {}
```

### 2. Basic Usage

```typescript
import { KinesisService } from '@onivoro/server-aws-kinesis';

@Injectable()
export class EventStreamingService {
  constructor(private kinesisService: KinesisService) {}

  async publishUserEvent(userId: string, eventData: any) {
    const event = {
      eventType: 'USER_ACTION',
      userId,
      timestamp: new Date().toISOString(),
      data: eventData
    };

    await this.kinesisService.publish(event, userId);
  }

  async publishOrderEvent(orderId: string, orderData: any) {
    const event = {
      eventType: 'ORDER_CREATED',
      orderId,
      timestamp: new Date().toISOString(),
      data: orderData
    };

    // Use orderId as partition key to ensure order events are processed in sequence
    await this.kinesisService.publish(event, orderId);
  }
}
```

## Configuration

### ServerAwsKinesisConfig

```typescript
import { ServerAwsKinesisConfig } from '@onivoro/server-aws-kinesis';

export class AppKinesisConfig extends ServerAwsKinesisConfig {
  AWS_REGION = process.env.AWS_REGION || 'us-east-1';
  AWS_KINESIS_NAME = process.env.KINESIS_STREAM_NAME || 'my-data-stream';
  AWS_PROFILE = process.env.AWS_PROFILE || 'default';
  KINESIS_SHARD_COUNT = parseInt(process.env.KINESIS_SHARD_COUNT) || 1;
  KINESIS_RETENTION_PERIOD = parseInt(process.env.KINESIS_RETENTION_PERIOD) || 24; // hours
}
```

### Environment Variables

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_PROFILE=default

# Kinesis Configuration
KINESIS_STREAM_NAME=my-application-stream
KINESIS_SHARD_COUNT=4
KINESIS_RETENTION_PERIOD=168  # 7 days in hours
```

## Services

### KinesisService

The main service for Kinesis operations:

```typescript
import { KinesisService } from '@onivoro/server-aws-kinesis';

@Injectable()
export class RealTimeDataService {
  constructor(private kinesisService: KinesisService) {}

  async publishMetrics(metrics: ApplicationMetrics) {
    const event = {
      type: 'METRICS',
      timestamp: new Date().toISOString(),
      metrics,
      source: 'application-server'
    };

    // Use timestamp-based partition key for even distribution
    const partitionKey = `metrics-${Date.now() % 1000}`;
    await this.kinesisService.publish(event, partitionKey);
  }

  async publishLogEvent(logLevel: string, message: string, context: any) {
    const logEvent = {
      level: logLevel,
      message,
      context,
      timestamp: new Date().toISOString(),
      service: 'my-service'
    };

    // Use log level as partition key to group similar logs
    await this.kinesisService.publish(logEvent, logLevel);
  }
}
```

## Usage Examples

### Event Publisher Service

```typescript
import { KinesisService } from '@onivoro/server-aws-kinesis';

@Injectable()
export class EventPublisherService {
  constructor(private kinesisService: KinesisService) {}

  async publishBusinessEvent<T>(eventType: string, entityId: string, eventData: T) {
    const event = {
      eventId: this.generateEventId(),
      eventType,
      entityId,
      entityType: this.getEntityType(eventType),
      timestamp: new Date().toISOString(),
      version: '1.0',
      data: eventData,
      metadata: {
        source: 'business-service',
        correlationId: this.generateCorrelationId()
      }
    };

    // Use entity ID as partition key to maintain order for the same entity
    await this.kinesisService.publish(event, entityId);
    
    console.log(`Published ${eventType} event for entity ${entityId}`);
  }

  async publishBulkEvents<T>(events: Array<{ eventType: string; entityId: string; data: T }>) {
    const publishPromises = events.map(event => 
      this.publishBusinessEvent(event.eventType, event.entityId, event.data)
    );

    await Promise.all(publishPromises);
    console.log(`Published ${events.length} events to Kinesis stream`);
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getEntityType(eventType: string): string {
    const entityMappings = {
      'USER_CREATED': 'user',
      'USER_UPDATED': 'user',
      'ORDER_CREATED': 'order',
      'ORDER_UPDATED': 'order',
      'PAYMENT_PROCESSED': 'payment'
    };
    
    return entityMappings[eventType] || 'unknown';
  }
}
```

### Stream Analytics Service

```typescript
import { KinesisService } from '@onivoro/server-aws-kinesis';

@Injectable()
export class StreamAnalyticsService {
  constructor(private kinesisService: KinesisService) {}

  async publishUserBehavior(userId: string, action: string, context: any) {
    const behaviorEvent = {
      userId,
      action,
      context,
      timestamp: new Date().toISOString(),
      sessionId: context.sessionId,
      deviceInfo: {
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        platform: context.platform
      },
      pageInfo: {
        url: context.url,
        referrer: context.referrer,
        title: context.title
      }
    };

    // Use user ID as partition key for user-specific analytics
    await this.kinesisService.publish(behaviorEvent, userId);
  }

  async publishPerformanceMetrics(metrics: PerformanceMetrics) {
    const performanceEvent = {
      type: 'PERFORMANCE_METRICS',
      metrics: {
        responseTime: metrics.responseTime,
        throughput: metrics.throughput,
        errorRate: metrics.errorRate,
        cpuUsage: metrics.cpuUsage,
        memoryUsage: metrics.memoryUsage
      },
      timestamp: new Date().toISOString(),
      service: metrics.serviceName,
      environment: process.env.NODE_ENV || 'development'
    };

    // Use service name as partition key
    await this.kinesisService.publish(performanceEvent, metrics.serviceName);
  }

  async publishBusinessInsights(insight: BusinessInsight) {
    const insightEvent = {
      type: 'BUSINESS_INSIGHT',
      category: insight.category,
      metric: insight.metric,
      value: insight.value,
      dimensions: insight.dimensions,
      timestamp: new Date().toISOString(),
      period: insight.period,
      metadata: insight.metadata
    };

    // Use category as partition key for business insights
    await this.kinesisService.publish(insightEvent, insight.category);
  }
}
```

### Partition Strategy Service

```typescript
import { KinesisService } from '@onivoro/server-aws-kinesis';

@Injectable()
export class PartitionStrategyService {
  constructor(private kinesisService: KinesisService) {}

  async publishWithHashPartitioning<T>(data: T, partitionField: string) {
    const partitionKey = this.generateHashPartition(data[partitionField]);
    await this.kinesisService.publish(data, partitionKey);
  }

  async publishWithTimeBasedPartitioning<T>(data: T, timeWindow: number = 60000) {
    // Group events by time windows (default 1 minute)
    const timeSlot = Math.floor(Date.now() / timeWindow);
    const partitionKey = `time_${timeSlot}`;
    await this.kinesisService.publish(data, partitionKey);
  }

  async publishWithCustomPartitioning<T>(data: T, partitionStrategy: PartitionStrategy) {
    let partitionKey: string;

    switch (partitionStrategy.type) {
      case 'random':
        partitionKey = this.generateRandomPartition(partitionStrategy.shardCount);
        break;
      case 'round-robin':
        partitionKey = this.generateRoundRobinPartition(partitionStrategy.shardCount);
        break;
      case 'field-based':
        partitionKey = data[partitionStrategy.field];
        break;
      case 'composite':
        partitionKey = this.generateCompositePartition(data, partitionStrategy.fields);
        break;
      default:
        partitionKey = 'default';
    }

    await this.kinesisService.publish(data, partitionKey);
  }

  private generateHashPartition(value: string): string {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `hash_${Math.abs(hash)}`;
  }

  private generateRandomPartition(shardCount: number): string {
    const randomNum = Math.floor(Math.random() * shardCount);
    return `random_${randomNum}`;
  }

  private generateRoundRobinPartition(shardCount: number): string {
    // This would need to track state across calls
    const counter = this.getRoundRobinCounter();
    const partition = counter % shardCount;
    this.incrementRoundRobinCounter();
    return `rr_${partition}`;
  }

  private generateCompositePartition(data: any, fields: string[]): string {
    const values = fields.map(field => data[field]).join('_');
    return `composite_${values}`;
  }

  private getRoundRobinCounter(): number {
    // Implementation would store counter state
    return 0;
  }

  private incrementRoundRobinCounter(): void {
    // Implementation would increment counter state
  }
}
```

### Stream Management Service

```typescript
import { KinesisClient, CreateStreamCommand, DescribeStreamCommand, DeleteStreamCommand } from '@aws-sdk/client-kinesis';

@Injectable()
export class KinesisStreamManagementService {
  constructor(private kinesisClient: KinesisClient) {}

  async createStream(streamName: string, shardCount: number = 1) {
    const createStreamCommand = new CreateStreamCommand({
      StreamName: streamName,
      ShardCount: shardCount
    });

    return this.kinesisClient.send(createStreamCommand);
  }

  async getStreamStatus(streamName: string) {
    const describeStreamCommand = new DescribeStreamCommand({
      StreamName: streamName
    });

    return this.kinesisClient.send(describeStreamCommand);
  }

  async waitForStreamActive(streamName: string, maxAttempts: number = 30) {
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      const response = await this.getStreamStatus(streamName);
      const status = response.StreamDescription?.StreamStatus;
      
      if (status === 'ACTIVE') {
        console.log(`Stream ${streamName} is active`);
        return response;
      }
      
      if (status === 'DELETING') {
        throw new Error(`Stream ${streamName} is being deleted`);
      }
      
      console.log(`Stream ${streamName} status: ${status}, waiting...`);
      await this.delay(10000); // Wait 10 seconds
      attempts++;
    }
    
    throw new Error(`Stream ${streamName} did not become active within timeout`);
  }

  async deleteStream(streamName: string) {
    const deleteStreamCommand = new DeleteStreamCommand({
      StreamName: streamName
    });

    return this.kinesisClient.send(deleteStreamCommand);
  }

  async ensureStreamExists(streamName: string, shardCount: number = 1) {
    try {
      const response = await this.getStreamStatus(streamName);
      console.log(`Stream ${streamName} already exists with status: ${response.StreamDescription?.StreamStatus}`);
      return response;
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        console.log(`Creating stream ${streamName} with ${shardCount} shards`);
        await this.createStream(streamName, shardCount);
        return this.waitForStreamActive(streamName);
      }
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Advanced Usage

### Stream Consumer Base Class

```typescript
import { KinesisClient, GetRecordsCommand, GetShardIteratorCommand } from '@aws-sdk/client-kinesis';

export abstract class KinesisConsumerBase {
  protected abstract processRecord(record: any): Promise<void>;
  
  constructor(
    protected kinesisClient: KinesisClient,
    protected streamName: string
  ) {}

  async startConsuming(shardId: string, iteratorType: string = 'LATEST') {
    try {
      // Get shard iterator
      const shardIteratorResponse = await this.kinesisClient.send(
        new GetShardIteratorCommand({
          StreamName: this.streamName,
          ShardId: shardId,
          ShardIteratorType: iteratorType
        })
      );

      let shardIterator = shardIteratorResponse.ShardIterator;

      // Start consuming records
      while (shardIterator) {
        const recordsResponse = await this.kinesisClient.send(
          new GetRecordsCommand({
            ShardIterator: shardIterator
          })
        );

        const records = recordsResponse.Records || [];
        
        if (records.length > 0) {
          console.log(`Processing ${records.length} records`);
          
          for (const record of records) {
            try {
              await this.processRecord(record);
            } catch (error) {
              console.error('Error processing record:', error);
              // Implement your error handling strategy here
            }
          }
        }

        shardIterator = recordsResponse.NextShardIterator;
        
        // Add delay to avoid hitting API limits
        await this.delay(1000);
      }
    } catch (error) {
      console.error('Error in consumer loop:', error);
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Monitoring and Metrics

```typescript
@Injectable()
export class KinesisMonitoringService {
  constructor(private kinesisService: KinesisService) {}

  private metricsBuffer: Array<{ eventType: string; timestamp: number; size: number }> = [];

  async publishWithMetrics<T>(data: T, partitionKey: string, eventType: string) {
    const startTime = Date.now();
    
    try {
      await this.kinesisService.publish(data, partitionKey);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      const dataSize = JSON.stringify(data).length;
      
      this.recordMetrics(eventType, duration, dataSize, 'success');
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      this.recordMetrics(eventType, duration, 0, 'error');
      throw error;
    }
  }

  private recordMetrics(eventType: string, duration: number, size: number, status: string) {
    this.metricsBuffer.push({
      eventType,
      timestamp: Date.now(),
      size
    });

    // Log metrics
    console.log(`Kinesis publish - Type: ${eventType}, Duration: ${duration}ms, Size: ${size} bytes, Status: ${status}`);
    
    // Publish metrics to monitoring system (e.g., CloudWatch)
    this.publishMetricsToCloudWatch(eventType, duration, size, status);
  }

  private async publishMetricsToCloudWatch(eventType: string, duration: number, size: number, status: string) {
    // Implementation would send metrics to CloudWatch
    // This is a placeholder for the actual implementation
  }

  getMetricsSummary() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    const recentMetrics = this.metricsBuffer.filter(m => m.timestamp > oneHourAgo);
    
    return {
      totalEvents: recentMetrics.length,
      totalSize: recentMetrics.reduce((sum, m) => sum + m.size, 0),
      eventsByType: recentMetrics.reduce((acc, m) => {
        acc[m.eventType] = (acc[m.eventType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }
}
```

## Best Practices

### 1. Partition Key Strategy

```typescript
// Good: Use entity ID for ordered processing
await kinesisService.publish(orderEvent, orderId);

// Good: Use hash for even distribution
const partitionKey = hashFunction(userId) % shardCount;

// Avoid: Using timestamp (creates hot shards)
// await kinesisService.publish(event, Date.now().toString());
```

### 2. Error Handling

```typescript
async safePublish<T>(data: T, partitionKey: string, retries: number = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await this.kinesisService.publish(data, partitionKey);
      return true;
    } catch (error: any) {
      console.error(`Publish attempt ${attempt} failed:`, error);
      
      if (attempt === retries) {
        console.error('Max retries reached, publish failed');
        return false;
      }
      
      // Exponential backoff
      await this.delay(Math.pow(2, attempt) * 1000);
    }
  }
  return false;
}
```

### 3. Data Validation

```typescript
validateEventData<T>(data: T): boolean {
  return data && 
         typeof data === 'object' && 
         JSON.stringify(data).length <= 1000000; // 1MB limit
}
```

## Testing

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ServerAwsKinesisModule, KinesisService } from '@onivoro/server-aws-kinesis';

describe('KinesisService', () => {
  let service: KinesisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ServerAwsKinesisModule.configure({
        AWS_REGION: 'us-east-1',
        AWS_KINESIS_NAME: 'test-stream',
        AWS_PROFILE: 'test'
      })],
    }).compile();

    service = module.get<KinesisService>(KinesisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should publish event', async () => {
    const testData = { test: 'data' };
    const partitionKey = 'test-key';
    
    await expect(service.publish(testData, partitionKey)).resolves.not.toThrow();
  });
});
```

## API Reference

### Exported Classes
- `ServerAwsKinesisConfig`: Configuration class for Kinesis settings
- `ServerAwsKinesisModule`: NestJS module for Kinesis integration

### Exported Services
- `KinesisService`: Main Kinesis service with data publishing capabilities

## License

This package is part of the Onivoro monorepo and follows the same licensing terms.