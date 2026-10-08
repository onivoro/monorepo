# @onivoro/server-aws-sns

AWS SNS integration for NestJS applications.

## Installation

```bash
npm install @onivoro/server-aws-sns @aws-sdk/client-sns
```

## Overview

This library provides AWS SNS client injection for NestJS applications. It's a minimal wrapper that configures and provides access to the AWS SNS client.

## Module Setup

```typescript
import { Module } from '@nestjs/common';
import { ServerAwsSnsModule } from '@onivoro/server-aws-sns';

@Module({
  imports: [
    ServerAwsSnsModule.configure({
      AWS_REGION: process.env.AWS_REGION!,
      AWS_PROFILE: process.env.AWS_PROFILE, // optional
    }),
  ],
})
export class AppModule {}
```

## Configuration

`configure()` takes the config object directly; the module does not read environment variables itself.

```typescript
export class ServerAwsSnsConfig {
  AWS_PROFILE?: string;
  AWS_REGION: string;
}
```

Credentials come from [`@onivoro/server-aws-credential-providers`](../aws-credential-providers/): when `AWS_PROFILE` is set the named profile is used, otherwise the AWS SDK default credential chain applies.

The module provides and exports an `SNSClient` (configured with `AWS_REGION`) and `ServerAwsSnsConfig`.

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
      Subject: subject,
    });

    return await this.snsClient.send(command);
  }

  // Send SMS
  async sendSMS(phoneNumber: string, message: string) {
    const command = new PublishCommand({
      PhoneNumber: phoneNumber,
      Message: message,
    });

    return await this.snsClient.send(command);
  }

  // Create topic
  async createTopic(topicName: string) {
    const command = new CreateTopicCommand({
      Name: topicName,
    });

    const response = await this.snsClient.send(command);
    return response.TopicArn;
  }

  // Subscribe to topic
  async subscribeEmail(topicArn: string, email: string) {
    const command = new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: 'email',
      Endpoint: email,
    });

    return await this.snsClient.send(command);
  }
}
```

## Common SNS Operations

Since this module only provides the client, here are examples of common operations:

### Topic Management

```typescript
import { CreateTopicCommand, DeleteTopicCommand, ListTopicsCommand, PublishCommand, SubscribeCommand } from '@aws-sdk/client-sns';

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
  Endpoint: 'user@example.com',
});
await snsClient.send(subscribeCommand);

// SMS subscription
const smsSubscribeCommand = new SubscribeCommand({
  TopicArn: 'arn:aws:sns:...',
  Protocol: 'sms',
  Endpoint: '+1234567890',
});
await snsClient.send(smsSubscribeCommand);
```

### Publishing

```typescript
// Simple message
const publishCommand = new PublishCommand({
  TopicArn: 'arn:aws:sns:...',
  Message: 'Hello World',
});
await snsClient.send(publishCommand);

// Structured message for multiple protocols
const structuredCommand = new PublishCommand({
  TopicArn: 'arn:aws:sns:...',
  Message: JSON.stringify({
    default: 'Default message',
    email: 'Detailed email message',
    sms: 'Short SMS',
  }),
  MessageStructure: 'json',
});
await snsClient.send(structuredCommand);
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
