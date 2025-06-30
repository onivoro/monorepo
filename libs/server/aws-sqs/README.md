# @onivoro/server-aws-sqs

A NestJS module for integrating with AWS SQS (Simple Queue Service) using AWS SDK v3. This library provides a simplified service for message publishing, queue verification, message counting, and batch message processing.

## Installation

This library is part of the Onivoro monorepo and should be used as an internal dependency.

## Features

- **Message Publishing**: Send JSON messages to SQS queues with error handling
- **Queue Verification**: Verify queue existence and check permissions
- **Message Counting**: Get approximate number of messages in queue
- **Batch Processing**: Process messages in batches with automatic deletion
- **AWS SDK v3**: Uses the latest AWS SDK with modern command-based API
- **Environment-Based Configuration**: Simple configuration via environment variables

## Quick Start

### 1. Module Configuration

```typescript
import { ServerAwsSqsModule } from '@onivoro/server-aws-sqs';

@Module({
  imports: [
    ServerAwsSqsModule.configure({
      AWS_REGION: 'us-east-1',
      AWS_SQS_URL: 'https://sqs.us-east-1.amazonaws.com/account-id/queue-name',
      AWS_PROFILE: 'your-aws-profile', // optional
    }),
  ],
})
export class AppModule {}
```

### 2. Basic Usage

```typescript
import { SqsService } from '@onivoro/server-aws-sqs';

@Injectable()
export class MessageService {
  constructor(private sqsService: SqsService) {}

  async sendMessage(data: any) {
    await this.sqsService.publish(data);
  }

  async processMessages(maxIterations: number = 10) {
    await this.sqsService.processMessageBatches(maxIterations);
  }

  async checkQueueHealth() {
    const isHealthy = await this.sqsService.verifyQueue();
    const messageCount = await this.sqsService.getApproximateNumberOfMessages();
    
    return { isHealthy, messageCount };
  }
}
```

## Configuration

### ServerAwsSqsConfig

The configuration class requires these properties:

```typescript
export class ServerAwsSqsConfig {
  AWS_PROFILE?: string;      // Optional AWS profile
  AWS_REGION: string;        // AWS region (required)
  AWS_SQS_URL: string;       // Full SQS queue URL (required)
}
```

### Environment Variables

```bash
# Required
AWS_REGION=us-east-1
AWS_SQS_URL=https://sqs.us-east-1.amazonaws.com/123456789012/my-queue

# Optional
AWS_PROFILE=default
```

## SqsService API

### publish<TData>(event: TData)

Publishes a message to the configured SQS queue. The message is JSON-serialized automatically.

```typescript
// Simple message
await sqsService.publish({ type: 'USER_CREATED', userId: '123' });

// Complex message
await sqsService.publish({
  eventType: 'ORDER_PROCESSED',
  orderId: 'order-456',
  customerData: {
    id: 'customer-789',
    email: 'customer@example.com'
  },
  timestamp: new Date().toISOString(),
  metadata: {
    source: 'order-service',
    version: '1.0'
  }
});
```

**Error Handling**: Errors are caught and logged to console, but the method does not throw.

### verifyQueue()

Verifies that the queue exists and the service has proper permissions to access it.

```typescript
try {
  await sqsService.verifyQueue();
  console.log('Queue is accessible');
} catch (error) {
  // Handle specific error types:
  // - AWS.SimpleQueueService.NonExistentQueue: Queue doesn't exist
  // - AccessDeniedException: Insufficient permissions
  console.error('Queue verification failed:', error);
}
```

**Returns**: `Promise<boolean>` - Returns `true` on success, throws on failure.

### getApproximateNumberOfMessages()

Gets the approximate number of messages currently in the queue.

```typescript
const messageCount = await sqsService.getApproximateNumberOfMessages();
console.log(`Queue has approximately ${messageCount} messages`);

// Use for monitoring
if (messageCount > 1000) {
  console.warn('Queue backlog is high!');
}
```

**Returns**: `Promise<number>` - The approximate message count.

### processMessageBatches(maxIterations: number)

Processes messages from the queue in batches, automatically deleting successfully processed messages.

```typescript
// Process up to 10 iterations (batches)
await sqsService.processMessageBatches(10);

// Process fewer batches for quick processing
await sqsService.processMessageBatches(3);
```

**Batch Configuration**:
- **MaxNumberOfMessages**: 10 messages per batch
- **WaitTimeSeconds**: 20 seconds (long polling)
- **VisibilityTimeout**: 30 seconds
- **Auto-deletion**: Messages are automatically deleted after retrieval

**Processing Logic**:
1. Checks message count before each iteration
2. Receives up to 10 messages with long polling
3. Parses message bodies as JSON
4. Logs received messages to console
5. Automatically deletes all received messages
6. Continues until max iterations or no messages remain

## Usage Examples

### Event Publishing Service

```typescript
@Injectable()
export class EventPublisherService {
  constructor(private sqsService: SqsService) {}

  async publishUserEvent(userId: string, eventType: string, eventData: any) {
    const message = {
      eventType,
      userId,
      data: eventData,
      timestamp: new Date().toISOString(),
      correlationId: `user-${userId}-${Date.now()}`
    };

    await this.sqsService.publish(message);
  }

  async publishOrderEvents(orders: Array<{ id: string; status: string; customerId: string }>) {
    // Publish multiple events
    const publishPromises = orders.map(order =>
      this.sqsService.publish({
        type: 'ORDER_STATUS_CHANGED',
        orderId: order.id,
        customerId: order.customerId,
        newStatus: order.status,
        timestamp: new Date().toISOString()
      })
    );

    await Promise.allSettled(publishPromises);
  }
}
```

### Queue Monitoring Service

```typescript
@Injectable()
export class QueueMonitoringService {
  constructor(private sqsService: SqsService) {}

  async getQueueHealth() {
    try {
      const [isAccessible, messageCount] = await Promise.all([
        this.sqsService.verifyQueue().then(() => true).catch(() => false),
        this.sqsService.getApproximateNumberOfMessages().catch(() => -1)
      ]);

      return {
        accessible: isAccessible,
        messageCount,
        status: this.determineStatus(messageCount),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        accessible: false,
        messageCount: -1,
        status: 'ERROR',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  private determineStatus(messageCount: number): string {
    if (messageCount < 0) return 'ERROR';
    if (messageCount === 0) return 'EMPTY';
    if (messageCount < 100) return 'NORMAL';
    if (messageCount < 1000) return 'BUSY';
    return 'OVERLOADED';
  }

  async startMonitoring(intervalSeconds: number = 60) {
    setInterval(async () => {
      const health = await this.getQueueHealth();
      console.log('Queue Health:', health);
      
      if (health.status === 'OVERLOADED') {
        console.warn('⚠️ Queue is overloaded! Consider scaling processing.');
      }
    }, intervalSeconds * 1000);
  }
}
```

### Message Processing Worker

```typescript
@Injectable()
export class MessageProcessorService {
  constructor(private sqsService: SqsService) {}

  async startProcessing(maxBatches: number = 50) {
    console.log(`Starting message processing (max ${maxBatches} batches)...`);
    
    const startTime = Date.now();
    await this.sqsService.processMessageBatches(maxBatches);
    const duration = Date.now() - startTime;
    
    console.log(`Processing completed in ${duration}ms`);
  }

  async processUntilEmpty(maxIterations: number = 100) {
    let iteration = 0;
    let messageCount = await this.sqsService.getApproximateNumberOfMessages();
    
    console.log(`Starting processing: ${messageCount} messages in queue`);
    
    while (messageCount > 0 && iteration < maxIterations) {
      await this.sqsService.processMessageBatches(1);
      messageCount = await this.sqsService.getApproximateNumberOfMessages();
      iteration++;
      
      console.log(`Iteration ${iteration}: ${messageCount} messages remaining`);
      
      // Brief pause between iterations
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`Processing complete. Final count: ${messageCount} messages`);
  }
}
```

### Scheduled Processing Service

```typescript
@Injectable()
export class ScheduledProcessorService {
  private isProcessing = false;
  
  constructor(private sqsService: SqsService) {}

  @Cron('*/30 * * * * *') // Every 30 seconds
  async processMessages() {
    if (this.isProcessing) {
      console.log('Processing already in progress, skipping...');
      return;
    }

    this.isProcessing = true;
    
    try {
      const messageCount = await this.sqsService.getApproximateNumberOfMessages();
      
      if (messageCount > 0) {
        console.log(`Processing ${messageCount} messages...`);
        await this.sqsService.processMessageBatches(5); // Process up to 5 batches
      }
    } catch (error) {
      console.error('Scheduled processing failed:', error);
    } finally {
      this.isProcessing = false;
    }
  }
}
```

## Error Handling

The service handles errors gracefully:

```typescript
// Publishing - errors are logged but not thrown
await sqsService.publish({ data: 'test' }); // Won't throw even if queue is inaccessible

// Queue verification - throws on error for proper error handling
try {
  await sqsService.verifyQueue();
} catch (error) {
  if (error.name === 'AWS.SimpleQueueService.NonExistentQueue') {
    console.error('Queue does not exist');
  } else if (error.name === 'AccessDeniedException') {
    console.error('Insufficient permissions');
  }
}

// Message counting - throws on error
try {
  const count = await sqsService.getApproximateNumberOfMessages();
} catch (error) {
  console.error('Failed to get message count:', error);
}

// Batch processing - errors logged per batch, doesn't stop processing
await sqsService.processMessageBatches(10); // Continues even if some batches fail
```

## Best Practices

### 1. Message Structure

Use consistent message structures for better processing:

```typescript
interface StandardMessage {
  type: string;
  data: any;
  timestamp: string;
  correlationId?: string;
  source?: string;
  version?: string;
}

await sqsService.publish({
  type: 'USER_REGISTRATION',
  data: { userId: '123', email: 'user@example.com' },
  timestamp: new Date().toISOString(),
  correlationId: 'reg-123',
  source: 'auth-service',
  version: '1.0'
});
```

### 2. Batch Processing Considerations

- The service processes messages but doesn't provide custom message handling
- Messages are automatically deleted after being received
- Use moderate `maxIterations` values to avoid infinite processing
- Monitor message counts before and after processing

### 3. Queue Monitoring

```typescript
// Regular health checks
const health = await sqsService.verifyQueue().catch(() => false);
const count = await sqsService.getApproximateNumberOfMessages().catch(() => 0);

if (!health) {
  console.error('Queue health check failed');
}

if (count > threshold) {
  console.warn(`Queue backlog: ${count} messages`);
}
```

## Testing

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ServerAwsSqsModule, SqsService } from '@onivoro/server-aws-sqs';

describe('SqsService', () => {
  let service: SqsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ServerAwsSqsModule.configure({
          AWS_REGION: 'us-east-1',
          AWS_SQS_URL: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
          AWS_PROFILE: 'test'
        }),
      ],
    }).compile();

    service = module.get<SqsService>(SqsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should publish message without throwing', async () => {
    const testData = { type: 'TEST_EVENT', data: 'test' };
    await expect(service.publish(testData)).resolves.not.toThrow();
  });

  it('should get message count', async () => {
    const count = await service.getApproximateNumberOfMessages();
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
```

## API Reference

### Configuration Classes
- `ServerAwsSqsConfig`: Configuration class requiring AWS_REGION and AWS_SQS_URL

### Modules  
- `ServerAwsSqsModule`: NestJS module with `configure()` method for setup

### Services
- `SqsService`: Main service with four methods:
  - `publish<TData>(event: TData): Promise<void>`
  - `verifyQueue(): Promise<boolean>`
  - `getApproximateNumberOfMessages(): Promise<number>`
  - `processMessageBatches(maxIterations: number): Promise<void>`

### AWS SDK Dependencies
- Uses `@aws-sdk/client-sqs` v3
- Commands used: `SendMessageCommand`, `GetQueueAttributesCommand`, `ReceiveMessageCommand`, `DeleteMessageBatchCommand`

## License

This package is part of the Onivoro monorepo and follows the same licensing terms.