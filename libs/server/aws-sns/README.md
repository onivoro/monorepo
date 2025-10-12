# @onivoro/server-aws-sns

AWS SNS integration for NestJS applications.

## Installation

```bash
npm install @onivoro/server-aws-sns
```

## Overview

This library provides AWS SNS client injection for NestJS applications. It's a minimal wrapper that configures and provides access to the AWS SNS client.

## Module Setup

```typescript
import { Module } from '@nestjs/common';
import { ServerAwsSnsModule } from '@onivoro/server-aws-sns';

@Module({
  imports: [
    ServerAwsSnsModule.configure()
  ]
})
export class AppModule {}
```

## Configuration

The module uses environment-based configuration:

```typescript
export class ServerAwsSnsConfig {
  AWS_REGION: string;
  AWS_PROFILE?: string;  // Optional AWS profile
}
```

## Usage

This module provides only the SNS client injection. There is no custom service implementation. You need to inject the SNS client directly and use AWS SDK methods:

```typescript
import { Injectable } from '@nestjs/common';
import { SNSClient, PublishCommand, CreateTopicCommand, SubscribeCommand } from '@aws-sdk/client-sns';

@Injectable()
export class NotificationService {
  constructor(private readonly snsClient: SNSClient) {}

  // Publish message to topic
  async publishToTopic(topicArn: string, message: string, subject?: string) {
    const command = new PublishCommand({
      TopicArn: topicArn,
      Message: message,
      Subject: subject
    });
    
    return await this.snsClient.send(command);
  }

  // Send SMS
  async sendSMS(phoneNumber: string, message: string) {
    const command = new PublishCommand({
      PhoneNumber: phoneNumber,
      Message: message
    });
    
    return await this.snsClient.send(command);
  }

  // Create topic
  async createTopic(topicName: string) {
    const command = new CreateTopicCommand({
      Name: topicName
    });
    
    const response = await this.snsClient.send(command);
    return response.TopicArn;
  }

  // Subscribe to topic
  async subscribeEmail(topicArn: string, email: string) {
    const command = new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: 'email',
      Endpoint: email
    });
    
    return await this.snsClient.send(command);
  }
}
```

## Complete Example

```typescript
import { Module, Injectable, Controller, Post, Body } from '@nestjs/common';
import { ServerAwsSnsModule } from '@onivoro/server-aws-sns';
import { 
  SNSClient, 
  PublishCommand, 
  CreateTopicCommand, 
  ListTopicsCommand,
  DeleteTopicCommand 
} from '@aws-sdk/client-sns';

@Module({
  imports: [ServerAwsSnsModule.configure()],
  controllers: [NotificationController],
  providers: [NotificationService]
})
export class NotificationModule {}

@Injectable()
export class NotificationService {
  constructor(private readonly snsClient: SNSClient) {}

  async sendNotification(type: string, message: string, recipients: string[]) {
    const topicName = `notifications-${type}`;
    
    // Create or get topic
    const createCommand = new CreateTopicCommand({ Name: topicName });
    const { TopicArn } = await this.snsClient.send(createCommand);

    // Publish message
    const publishCommand = new PublishCommand({
      TopicArn,
      Message: JSON.stringify({
        default: message,
        email: message,
        sms: message.substring(0, 140) // SMS has character limit
      }),
      MessageStructure: 'json',
      Subject: `${type} Notification`
    });

    return await this.snsClient.send(publishCommand);
  }

  async sendBulkSMS(phoneNumbers: string[], message: string) {
    const results = await Promise.allSettled(
      phoneNumbers.map(phone => 
        this.snsClient.send(new PublishCommand({
          PhoneNumber: phone,
          Message: message
        }))
      )
    );

    return {
      successful: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length
    };
  }

  async listTopics() {
    const command = new ListTopicsCommand({});
    const response = await this.snsClient.send(command);
    return response.Topics;
  }
}

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('send')
  async sendNotification(@Body() body: {
    type: string;
    message: string;
    recipients: string[];
  }) {
    return await this.notificationService.sendNotification(
      body.type,
      body.message,
      body.recipients
    );
  }

  @Post('sms/bulk')
  async sendBulkSMS(@Body() body: {
    phoneNumbers: string[];
    message: string;
  }) {
    return await this.notificationService.sendBulkSMS(
      body.phoneNumbers,
      body.message
    );
  }
}
```

## Common SNS Operations

Since this module only provides the client, here are examples of common operations:

### Topic Management
```typescript
// Create topic
const createCommand = new CreateTopicCommand({ Name: 'my-topic' });
const { TopicArn } = await snsClient.send(createCommand);

// List topics
const listCommand = new ListTopicsCommand({});
const { Topics } = await snsClient.send(listCommand);

// Delete topic
const deleteCommand = new DeleteTopicCommand({ TopicArn });
await snsClient.send(deleteCommand);
```

### Subscriptions
```typescript
// Email subscription
const subscribeCommand = new SubscribeCommand({
  TopicArn: 'arn:aws:sns:...',
  Protocol: 'email',
  Endpoint: 'user@example.com'
});
await snsClient.send(subscribeCommand);

// SMS subscription
const smsSubscribeCommand = new SubscribeCommand({
  TopicArn: 'arn:aws:sns:...',
  Protocol: 'sms',
  Endpoint: '+1234567890'
});
await snsClient.send(smsSubscribeCommand);
```

### Publishing
```typescript
// Simple message
const publishCommand = new PublishCommand({
  TopicArn: 'arn:aws:sns:...',
  Message: 'Hello World'
});
await snsClient.send(publishCommand);

// Structured message for multiple protocols
const structuredCommand = new PublishCommand({
  TopicArn: 'arn:aws:sns:...',
  Message: JSON.stringify({
    default: 'Default message',
    email: 'Detailed email message',
    sms: 'Short SMS'
  }),
  MessageStructure: 'json'
});
await snsClient.send(structuredCommand);
```

## Environment Variables

```bash
# Required
AWS_REGION=us-east-1

# Optional
AWS_PROFILE=my-profile
```

## Limitations

- No custom service implementation - only provides SNS client
- No built-in error handling or retry logic
- No message formatting utilities
- No subscription management helpers
- Must use AWS SDK methods directly

## Best Practices

1. **Error Handling**: Implement proper error handling for SNS operations
2. **Message Size**: Keep messages under 256 KB
3. **Phone Numbers**: Validate phone numbers in E.164 format
4. **Topics**: Use meaningful topic names and manage lifecycle
5. **Permissions**: Ensure proper IAM permissions for SNS operations

## License

MIT