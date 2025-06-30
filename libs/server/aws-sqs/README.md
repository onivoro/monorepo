# @onivoro/server-aws-sqs

A NestJS module for integrating with AWS SQS (Simple Queue Service), providing message publishing, polling, queue management, and batch processing capabilities for your server applications.

## Installation

```bash
npm install @onivoro/server-aws-sqs
```

## Features

- **Message Publishing**: Send messages to SQS queues
- **Queue Polling**: Receive and process messages from queues
- **Batch Processing**: Handle multiple messages efficiently
- **Queue Management**: Create, verify, and manage SQS queues
- **Message Visibility**: Control message visibility timeout
- **Dead Letter Queues**: Support for failed message handling
- **Automatic Retry**: Built-in retry logic for failed operations
- **Environment-Based Configuration**: Configurable SQS settings per environment

## Quick Start

### 1. Module Configuration

```typescript
import { ServerAwsSqsModule } from '@onivoro/server-aws-sqs';

@Module({
  imports: [
    ServerAwsSqsModule.configure({
      AWS_REGION: 'us-east-1',
      AWS_SQS_URL: process.env.SQS_QUEUE_URL,
      AWS_PROFILE: process.env.AWS_PROFILE || 'default',
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

```typescript
import { ServerAwsSqsConfig } from '@onivoro/server-aws-sqs';

export class AppSqsConfig extends ServerAwsSqsConfig {
  AWS_REGION = process.env.AWS_REGION || 'us-east-1';
  AWS_SQS_URL = process.env.SQS_QUEUE_URL || 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue';
  AWS_PROFILE = process.env.AWS_PROFILE || 'default';
  MAX_RECEIVE_COUNT = parseInt(process.env.SQS_MAX_RECEIVE_COUNT) || 3;
  VISIBILITY_TIMEOUT = parseInt(process.env.SQS_VISIBILITY_TIMEOUT) || 30;
  WAIT_TIME_SECONDS = parseInt(process.env.SQS_WAIT_TIME_SECONDS) || 20;
}
```

### Environment Variables

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_PROFILE=default

# SQS Configuration
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/my-queue
SQS_MAX_RECEIVE_COUNT=3
SQS_VISIBILITY_TIMEOUT=30
SQS_WAIT_TIME_SECONDS=20
```

## Services

### SqsService

The main service for SQS operations:

```typescript
import { SqsService } from '@onivoro/server-aws-sqs';

@Injectable()
export class QueueMessageService {
  constructor(private sqsService: SqsService) {}

  async publishOrder(order: OrderData) {
    await this.sqsService.publish({
      type: 'ORDER_CREATED',
      data: order,
      timestamp: new Date().toISOString(),
      correlationId: order.id
    });
  }

  async publishNotification(notification: NotificationData) {
    await this.sqsService.publish({
      type: 'NOTIFICATION',
      data: notification,
      timestamp: new Date().toISOString()
    });
  }

  async getQueueStats() {
    const messageCount = await this.sqsService.getApproximateNumberOfMessages();
    return { messageCount };
  }
}
```

## Usage Examples

### Message Publisher Service

```typescript
import { SqsService } from '@onivoro/server-aws-sqs';
import { Injectable } from '@nestjs/common';

@Injectable()
export class EventPublisherService {
  constructor(private sqsService: SqsService) {}

  async publishUserEvent(userId: string, eventType: string, eventData: any) {
    const message = {
      eventType,
      userId,
      data: eventData,
      timestamp: new Date().toISOString(),
      messageId: `${userId}-${Date.now()}`,
      version: '1.0'
    };

    await this.sqsService.publish(message);
    console.log(`Published ${eventType} event for user ${userId}`);
  }

  async publishBatchEvents(events: Array<{ userId: string; eventType: string; data: any }>) {
    const publishPromises = events.map(event => 
      this.publishUserEvent(event.userId, event.eventType, event.data)
    );

    await Promise.all(publishPromises);
    console.log(`Published ${events.length} events to queue`);
  }

  async publishDelayedEvent(eventData: any, delaySeconds: number) {
    // Note: For delayed messages, you'd need to use DelaySeconds parameter
    // This would require extending the SqsService or using SQS client directly
    const message = {
      ...eventData,
      scheduledFor: new Date(Date.now() + delaySeconds * 1000).toISOString()
    };

    await this.sqsService.publish(message);
  }
}
```

### Custom Message Processor

```typescript
import { SqsService } from '@onivoro/server-aws-sqs';
import { Injectable } from '@nestjs/common';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';

@Injectable()
export class CustomMessageProcessor {
  constructor(
    private sqsService: SqsService,
    private sqsClient: SQSClient
  ) {}

  async processMessagesWithCustomLogic() {
    try {
      const response = await this.sqsClient.send(new ReceiveMessageCommand({
        QueueUrl: process.env.SQS_QUEUE_URL,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 20,
        VisibilityTimeout: 60 // Longer timeout for complex processing
      }));

      const messages = response.Messages || [];

      for (const message of messages) {
        try {
          const messageData = JSON.parse(message.Body || '{}');
          
          // Process the message based on its type
          await this.processMessageByType(messageData);

          // Delete the message after successful processing
          await this.sqsClient.send(new DeleteMessageCommand({
            QueueUrl: process.env.SQS_QUEUE_URL,
            ReceiptHandle: message.ReceiptHandle
          }));

          console.log(`Successfully processed message: ${message.MessageId}`);
        } catch (error) {
          console.error(`Failed to process message ${message.MessageId}:`, error);
          // Message will become visible again after visibility timeout
        }
      }

      return messages.length;
    } catch (error) {
      console.error('Error processing messages:', error);
      throw error;
    }
  }

  private async processMessageByType(messageData: any) {
    switch (messageData.type || messageData.eventType) {
      case 'ORDER_CREATED':
        await this.processOrderCreated(messageData.data);
        break;
      case 'USER_REGISTERED':
        await this.processUserRegistration(messageData.data);
        break;
      case 'NOTIFICATION':
        await this.processNotification(messageData.data);
        break;
      default:
        console.warn(`Unknown message type: ${messageData.type}`);
    }
  }

  private async processOrderCreated(orderData: any) {
    console.log(`Processing order: ${orderData.id}`);
    // Implement order processing logic
  }

  private async processUserRegistration(userData: any) {
    console.log(`Processing user registration: ${userData.email}`);
    // Implement user registration processing logic
  }

  private async processNotification(notificationData: any) {
    console.log(`Processing notification: ${notificationData.type}`);
    // Implement notification processing logic
  }
}
```

### Queue Management Service

```typescript
import { SQSClient, CreateQueueCommand, GetQueueAttributesCommand, SetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SqsQueueManagementService {
  constructor(private sqsClient: SQSClient) {}

  async createQueue(queueName: string, attributes?: Record<string, string>) {
    const params = {
      QueueName: queueName,
      Attributes: {
        VisibilityTimeoutSeconds: '30',
        MessageRetentionPeriod: '1209600', // 14 days
        ReceiveMessageWaitTimeSeconds: '20', // Enable long polling
        ...attributes
      }
    };

    return this.sqsClient.send(new CreateQueueCommand(params));
  }

  async createDeadLetterQueue(mainQueueName: string, maxReceiveCount: number = 3) {
    // Create dead letter queue
    const dlqName = `${mainQueueName}-dlq`;
    const dlqResponse = await this.createQueue(dlqName);
    
    if (!dlqResponse.QueueUrl) {
      throw new Error('Failed to create dead letter queue');
    }

    // Get DLQ attributes to get ARN
    const dlqAttributes = await this.sqsClient.send(new GetQueueAttributesCommand({
      QueueUrl: dlqResponse.QueueUrl,
      AttributeNames: ['QueueArn']
    }));

    const dlqArn = dlqAttributes.Attributes?.QueueArn;
    if (!dlqArn) {
      throw new Error('Failed to get DLQ ARN');
    }

    // Create main queue with DLQ configuration
    const redrivePolicy = JSON.stringify({
      deadLetterTargetArn: dlqArn,
      maxReceiveCount
    });

    return this.createQueue(mainQueueName, {
      RedrivePolicy: redrivePolicy
    });
  }

  async getQueueAttributes(queueUrl: string) {
    return this.sqsClient.send(new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ['All']
    }));
  }

  async updateQueueAttributes(queueUrl: string, attributes: Record<string, string>) {
    return this.sqsClient.send(new SetQueueAttributesCommand({
      QueueUrl: queueUrl,
      Attributes: attributes
    }));
  }
}
```

### Batch Message Processing Service

```typescript
import { SQSClient, ReceiveMessageCommand, DeleteMessageBatchCommand } from '@aws-sdk/client-sqs';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SqsBatchProcessorService {
  constructor(private sqsClient: SQSClient) {}

  async processBatchesWithRetry(queueUrl: string, maxBatches: number = 10, retryAttempts: number = 3) {
    let processedBatches = 0;
    let totalProcessedMessages = 0;

    while (processedBatches < maxBatches) {
      try {
        const response = await this.sqsClient.send(new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 20,
          VisibilityTimeout: 300 // 5 minutes for batch processing
        }));

        const messages = response.Messages || [];
        if (messages.length === 0) {
          console.log('No more messages to process');
          break;
        }

        console.log(`Processing batch of ${messages.length} messages`);

        // Process messages with retry logic
        const processedMessages = await this.processMessagesWithRetry(messages, retryAttempts);
        
        // Delete successfully processed messages
        if (processedMessages.length > 0) {
          await this.deleteMessageBatch(queueUrl, processedMessages);
          totalProcessedMessages += processedMessages.length;
        }

        processedBatches++;
      } catch (error) {
        console.error(`Error processing batch ${processedBatches + 1}:`, error);
        // Continue with next batch
      }
    }

    return {
      processedBatches,
      totalProcessedMessages
    };
  }

  private async processMessagesWithRetry(messages: any[], maxRetries: number) {
    const processedMessages = [];

    for (const message of messages) {
      let retryCount = 0;
      let processed = false;

      while (retryCount < maxRetries && !processed) {
        try {
          const messageData = JSON.parse(message.Body || '{}');
          await this.processMessage(messageData);
          processedMessages.push(message);
          processed = true;
        } catch (error) {
          retryCount++;
          console.error(`Retry ${retryCount}/${maxRetries} failed for message ${message.MessageId}:`, error);
          
          if (retryCount < maxRetries) {
            await this.delay(1000 * retryCount); // Exponential backoff
          }
        }
      }

      if (!processed) {
        console.error(`Failed to process message ${message.MessageId} after ${maxRetries} retries`);
      }
    }

    return processedMessages;
  }

  private async deleteMessageBatch(queueUrl: string, messages: any[]) {
    const entries = messages.map((message, index) => ({
      Id: index.toString(),
      ReceiptHandle: message.ReceiptHandle
    }));

    return this.sqsClient.send(new DeleteMessageBatchCommand({
      QueueUrl: queueUrl,
      Entries: entries
    }));
  }

  private async processMessage(messageData: any) {
    // Implement your message processing logic here
    console.log('Processing message:', messageData);
    
    // Simulate processing time
    await this.delay(100);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Advanced Usage

### Message Deduplication

```typescript
@Injectable()
export class SqsDeduplicationService {
  private processedMessages = new Set<string>();

  async publishWithDeduplication(data: any, deduplicationId?: string) {
    const messageId = deduplicationId || this.generateMessageId(data);
    
    if (this.processedMessages.has(messageId)) {
      console.log(`Message ${messageId} already processed, skipping`);
      return;
    }

    const message = {
      ...data,
      deduplicationId: messageId,
      timestamp: new Date().toISOString()
    };

    await this.sqsService.publish(message);
    this.processedMessages.add(messageId);
  }

  private generateMessageId(data: any): string {
    // Generate a unique ID based on message content
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }
}
```

### Queue Monitoring Service

```typescript
@Injectable()
export class SqsMonitoringService {
  constructor(private sqsService: SqsService) {}

  async getQueueMetrics() {
    const messageCount = await this.sqsService.getApproximateNumberOfMessages();
    
    return {
      approximateNumberOfMessages: messageCount,
      timestamp: new Date().toISOString(),
      status: messageCount > 1000 ? 'HIGH_LOAD' : 'NORMAL'
    };
  }

  async monitorQueue(intervalMs: number = 60000) {
    setInterval(async () => {
      try {
        const metrics = await this.getQueueMetrics();
        console.log('Queue metrics:', metrics);
        
        if (metrics.status === 'HIGH_LOAD') {
          console.warn('Queue has high message load!');
          // Implement alerting logic here
        }
      } catch (error) {
        console.error('Error monitoring queue:', error);
      }
    }, intervalMs);
  }
}
```

## Best Practices

### 1. Error Handling

```typescript
async safePublish<T>(data: T): Promise<boolean> {
  try {
    await this.sqsService.publish(data);
    return true;
  } catch (error: any) {
    console.error('Failed to publish message:', error);
    
    if (error.name === 'InvalidParameterValue') {
      console.error('Invalid message format');
    } else if (error.name === 'AWS.SimpleQueueService.NonExistentQueue') {
      console.error('Queue does not exist');
    }
    
    return false;
  }
}
```

### 2. Message Validation

```typescript
validateMessage(message: any): boolean {
  return message && 
         typeof message === 'object' && 
         message.type && 
         message.data;
}
```

### 3. Graceful Shutdown

```typescript
@Injectable()
export class SqsGracefulShutdown {
  private isShuttingDown = false;

  async shutdown() {
    this.isShuttingDown = true;
    console.log('Gracefully shutting down SQS processing...');
    
    // Wait for current processing to complete
    await this.waitForProcessingToComplete();
    
    console.log('SQS processing shutdown complete');
  }

  private async waitForProcessingToComplete() {
    // Implement logic to wait for current processing to complete
  }
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
      imports: [ServerAwsSqsModule.configure({
        AWS_REGION: 'us-east-1',
        AWS_SQS_URL: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
        AWS_PROFILE: 'test'
      })],
    }).compile();

    service = module.get<SqsService>(SqsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should publish message', async () => {
    const testData = { test: 'data' };
    await expect(service.publish(testData)).resolves.not.toThrow();
  });
});
```

## API Reference

### Exported Classes
- `ServerAwsSqsConfig`: Configuration class for SQS settings
- `ServerAwsSqsModule`: NestJS module for SQS integration

### Exported Services
- `SqsService`: Main SQS service with message publishing and processing capabilities

## License

This package is part of the Onivoro monorepo and follows the same licensing terms.