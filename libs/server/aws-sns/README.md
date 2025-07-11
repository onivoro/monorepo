# @onivoro/server-aws-sns

A NestJS module for integrating with AWS SNS (Simple Notification Service), providing message publishing, subscription management, and notification delivery capabilities for your server applications.

## Installation

```bash
npm install @onivoro/server-aws-sns
```

## Features

- **SNS Client Integration**: Direct integration with AWS SNS service
- **Message Publishing**: Publish messages to SNS topics
- **Subscription Management**: Create and manage topic subscriptions
- **SMS Notifications**: Send SMS messages directly through SNS
- **Email Notifications**: Send email notifications via SNS
- **Mobile Push Notifications**: Support for mobile app push notifications
- **Topic Management**: Create, list, and manage SNS topics
- **Message Attributes**: Support for custom message attributes and filtering
- **Environment-Based Configuration**: Configurable SNS settings per environment
- **Credential Provider Integration**: Seamless integration with AWS credential providers

## Quick Start

### 1. Module Configuration

```typescript
import { ServerAwsSnsModule } from '@onivoro/server-aws-sns';

@Module({
  imports: [
    ServerAwsSnsModule.configure({
      AWS_REGION: 'us-east-1',
      AWS_PROFILE: process.env.AWS_PROFILE || 'default',
    }),
  ],
})
export class AppModule {}
```

### 2. Basic Usage

```typescript
import { SNSClient, PublishCommand, CreateTopicCommand } from '@aws-sdk/client-sns';

@Injectable()
export class NotificationService {
  constructor(private snsClient: SNSClient) {}

  async publishMessage(topicArn: string, message: string, subject?: string) {
    const params = {
      TopicArn: topicArn,
      Message: message,
      Subject: subject
    };

    return this.snsClient.send(new PublishCommand(params));
  }

  async sendSMS(phoneNumber: string, message: string) {
    const params = {
      PhoneNumber: phoneNumber,
      Message: message
    };

    return this.snsClient.send(new PublishCommand(params));
  }

  async createTopic(topicName: string) {
    const params = {
      Name: topicName
    };

    return this.snsClient.send(new CreateTopicCommand(params));
  }
}
```

## Configuration

### ServerAwsSnsConfig

```typescript
import { ServerAwsSnsConfig } from '@onivoro/server-aws-sns';

export class AppSnsConfig extends ServerAwsSnsConfig {
  AWS_REGION = process.env.AWS_REGION || 'us-east-1';
  AWS_PROFILE = process.env.AWS_PROFILE || 'default';
}
```

### Environment Variables

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_PROFILE=default

# Optional SNS Configuration
SNS_DEFAULT_TOPIC_ARN=arn:aws:sns:us-east-1:123456789012:my-topic
```

## Usage Examples

### Topic Management Service

```typescript
import { 
  SNSClient, 
  CreateTopicCommand, 
  DeleteTopicCommand, 
  ListTopicsCommand,
  GetTopicAttributesCommand,
  SetTopicAttributesCommand
} from '@aws-sdk/client-sns';

@Injectable()
export class SnsTopicService {
  constructor(private snsClient: SNSClient) {}

  async createTopic(topicName: string, displayName?: string) {
    const createParams = {
      Name: topicName,
      Attributes: displayName ? { DisplayName: displayName } : undefined
    };

    const result = await this.snsClient.send(new CreateTopicCommand(createParams));
    return result.TopicArn;
  }

  async deleteTopic(topicArn: string) {
    const params = {
      TopicArn: topicArn
    };

    return this.snsClient.send(new DeleteTopicCommand(params));
  }

  async listTopics() {
    return this.snsClient.send(new ListTopicsCommand({}));
  }

  async getTopicAttributes(topicArn: string) {
    const params = {
      TopicArn: topicArn
    };

    return this.snsClient.send(new GetTopicAttributesCommand(params));
  }

  async setTopicDisplayName(topicArn: string, displayName: string) {
    const params = {
      TopicArn: topicArn,
      AttributeName: 'DisplayName',
      AttributeValue: displayName
    };

    return this.snsClient.send(new SetTopicAttributesCommand(params));
  }

  async enableDeliveryStatusLogging(topicArn: string, roleArn: string) {
    const attributes = {
      'DeliveryStatusSuccessSamplingRate': '100',
      'DeliveryStatusFailureSamplingRate': '100',
      'DeliveryStatusLogging': 'true',
      'DeliveryStatusLogSuccessFeedbackRoleArn': roleArn,
      'DeliveryStatusLogFailureFeedbackRoleArn': roleArn
    };

    const promises = Object.entries(attributes).map(([AttributeName, AttributeValue]) =>
      this.snsClient.send(new SetTopicAttributesCommand({
        TopicArn: topicArn,
        AttributeName,
        AttributeValue
      }))
    );

    return Promise.all(promises);
  }
}
```

### Subscription Management Service

```typescript
import { 
  SNSClient, 
  SubscribeCommand, 
  UnsubscribeCommand, 
  ListSubscriptionsByTopicCommand,
  ConfirmSubscriptionCommand
} from '@aws-sdk/client-sns';

@Injectable()
export class SnsSubscriptionService {
  constructor(private snsClient: SNSClient) {}

  async subscribeEmail(topicArn: string, emailAddress: string) {
    const params = {
      TopicArn: topicArn,
      Protocol: 'email',
      Endpoint: emailAddress
    };

    return this.snsClient.send(new SubscribeCommand(params));
  }

  async subscribeSMS(topicArn: string, phoneNumber: string) {
    const params = {
      TopicArn: topicArn,
      Protocol: 'sms',
      Endpoint: phoneNumber
    };

    return this.snsClient.send(new SubscribeCommand(params));
  }

  async subscribeHTTP(topicArn: string, httpEndpoint: string) {
    const params = {
      TopicArn: topicArn,
      Protocol: 'http',
      Endpoint: httpEndpoint
    };

    return this.snsClient.send(new SubscribeCommand(params));
  }

  async subscribeHTTPS(topicArn: string, httpsEndpoint: string) {
    const params = {
      TopicArn: topicArn,
      Protocol: 'https',
      Endpoint: httpsEndpoint
    };

    return this.snsClient.send(new SubscribeCommand(params));
  }

  async subscribeLambda(topicArn: string, lambdaArn: string) {
    const params = {
      TopicArn: topicArn,
      Protocol: 'lambda',
      Endpoint: lambdaArn
    };

    return this.snsClient.send(new SubscribeCommand(params));
  }

  async subscribeSQS(topicArn: string, sqsQueueArn: string) {
    const params = {
      TopicArn: topicArn,
      Protocol: 'sqs',
      Endpoint: sqsQueueArn
    };

    return this.snsClient.send(new SubscribeCommand(params));
  }

  async unsubscribe(subscriptionArn: string) {
    const params = {
      SubscriptionArn: subscriptionArn
    };

    return this.snsClient.send(new UnsubscribeCommand(params));
  }

  async listSubscriptions(topicArn: string) {
    const params = {
      TopicArn: topicArn
    };

    return this.snsClient.send(new ListSubscriptionsByTopicCommand(params));
  }

  async confirmSubscription(topicArn: string, token: string) {
    const params = {
      TopicArn: topicArn,
      Token: token
    };

    return this.snsClient.send(new ConfirmSubscriptionCommand(params));
  }
}
```

### Message Publishing Service

```typescript
import { SNSClient, PublishCommand, PublishBatchCommand } from '@aws-sdk/client-sns';

interface MessageAttributes {
  [key: string]: {
    DataType: 'String' | 'Number' | 'Binary';
    StringValue?: string;
    BinaryValue?: Uint8Array;
  };
}

@Injectable()
export class SnsPublishService {
  constructor(private snsClient: SNSClient) {}

  async publishMessage(
    topicArn: string, 
    message: string, 
    subject?: string, 
    messageAttributes?: MessageAttributes
  ) {
    const params = {
      TopicArn: topicArn,
      Message: message,
      Subject: subject,
      MessageAttributes: messageAttributes
    };

    return this.snsClient.send(new PublishCommand(params));
  }

  async publishStructuredMessage(
    topicArn: string,
    message: any,
    subject?: string,
    messageAttributes?: MessageAttributes
  ) {
    const messagePayload = {
      default: JSON.stringify(message),
      email: JSON.stringify(message),
      sms: typeof message === 'string' ? message : JSON.stringify(message)
    };

    const params = {
      TopicArn: topicArn,
      Message: JSON.stringify(messagePayload),
      Subject: subject,
      MessageStructure: 'json',
      MessageAttributes: messageAttributes
    };

    return this.snsClient.send(new PublishCommand(params));
  }

  async publishToPhone(phoneNumber: string, message: string, messageAttributes?: MessageAttributes) {
    const params = {
      PhoneNumber: phoneNumber,
      Message: message,
      MessageAttributes: messageAttributes
    };

    return this.snsClient.send(new PublishCommand(params));
  }

  async publishBatch(topicArn: string, messages: Array<{
    Id: string;
    Message: string;
    Subject?: string;
    MessageAttributes?: MessageAttributes;
  }>) {
    const params = {
      TopicArn: topicArn,
      PublishRequestEntries: messages
    };

    return this.snsClient.send(new PublishBatchCommand(params));
  }

  async publishWithDeduplication(
    topicArn: string,
    message: string,
    messageGroupId: string,
    messageDeduplicationId: string,
    subject?: string
  ) {
    const params = {
      TopicArn: topicArn,
      Message: message,
      Subject: subject,
      MessageGroupId: messageGroupId,
      MessageDeduplicationId: messageDeduplicationId
    };

    return this.snsClient.send(new PublishCommand(params));
  }

  async publishNotification(
    topicArn: string,
    notification: {
      title: string;
      body: string;
      data?: any;
      priority?: 'normal' | 'high';
    }
  ) {
    const messageAttributes: MessageAttributes = {
      'notification.title': {
        DataType: 'String',
        StringValue: notification.title
      },
      'notification.body': {
        DataType: 'String',
        StringValue: notification.body
      }
    };

    if (notification.priority) {
      messageAttributes['notification.priority'] = {
        DataType: 'String',
        StringValue: notification.priority
      };
    }

    return this.publishMessage(
      topicArn,
      JSON.stringify(notification),
      notification.title,
      messageAttributes
    );
  }
}
```

### Mobile Push Notification Service

```typescript
import { SNSClient, CreatePlatformApplicationCommand, CreatePlatformEndpointCommand, PublishCommand } from '@aws-sdk/client-sns';

@Injectable()
export class SnsMobilePushService {
  constructor(private snsClient: SNSClient) {}

  async createPlatformApplication(
    name: string, 
    platform: 'GCM' | 'APNS' | 'APNS_SANDBOX', 
    credentials: { [key: string]: string }
  ) {
    const params = {
      Name: name,
      Platform: platform,
      Attributes: credentials
    };

    return this.snsClient.send(new CreatePlatformApplicationCommand(params));
  }

  async createPlatformEndpoint(
    platformApplicationArn: string,
    token: string,
    customUserData?: string
  ) {
    const params = {
      PlatformApplicationArn: platformApplicationArn,
      Token: token,
      CustomUserData: customUserData
    };

    return this.snsClient.send(new CreatePlatformEndpointCommand(params));
  }

  async sendPushNotification(
    targetArn: string,
    message: string,
    badge?: number,
    sound?: string
  ) {
    const gcmPayload = {
      data: {
        message: message
      }
    };

    const apnsPayload = {
      aps: {
        alert: message,
        badge: badge,
        sound: sound || 'default'
      }
    };

    const messagePayload = {
      default: message,
      GCM: JSON.stringify(gcmPayload),
      APNS: JSON.stringify(apnsPayload),
      APNS_SANDBOX: JSON.stringify(apnsPayload)
    };

    const params = {
      TargetArn: targetArn,
      Message: JSON.stringify(messagePayload),
      MessageStructure: 'json'
    };

    return this.snsClient.send(new PublishCommand(params));
  }

  async sendSilentPushNotification(targetArn: string, data: any) {
    const gcmPayload = {
      data: data
    };

    const apnsPayload = {
      aps: {
        'content-available': 1
      },
      data: data
    };

    const messagePayload = {
      GCM: JSON.stringify(gcmPayload),
      APNS: JSON.stringify(apnsPayload),
      APNS_SANDBOX: JSON.stringify(apnsPayload)
    };

    const params = {
      TargetArn: targetArn,
      Message: JSON.stringify(messagePayload),
      MessageStructure: 'json'
    };

    return this.snsClient.send(new PublishCommand(params));
  }
}
```

### SMS Service

```typescript
import { SNSClient, PublishCommand, SetSMSAttributesCommand, GetSMSAttributesCommand } from '@aws-sdk/client-sns';

@Injectable()
export class SnsSmsService {
  constructor(private snsClient: SNSClient) {}

  async sendSMS(
    phoneNumber: string, 
    message: string, 
    senderName?: string,
    messageType?: 'Promotional' | 'Transactional'
  ) {
    const messageAttributes: any = {};

    if (senderName) {
      messageAttributes['AWS.SNS.SMS.SenderID'] = {
        DataType: 'String',
        StringValue: senderName
      };
    }

    if (messageType) {
      messageAttributes['AWS.SNS.SMS.SMSType'] = {
        DataType: 'String',
        StringValue: messageType
      };
    }

    const params = {
      PhoneNumber: phoneNumber,
      Message: message,
      MessageAttributes: Object.keys(messageAttributes).length > 0 ? messageAttributes : undefined
    };

    return this.snsClient.send(new PublishCommand(params));
  }

  async sendTransactionalSMS(phoneNumber: string, message: string, senderName?: string) {
    return this.sendSMS(phoneNumber, message, senderName, 'Transactional');
  }

  async sendPromotionalSMS(phoneNumber: string, message: string, senderName?: string) {
    return this.sendSMS(phoneNumber, message, senderName, 'Promotional');
  }

  async setSMSAttributes(attributes: { [key: string]: string }) {
    const promises = Object.entries(attributes).map(([key, value]) =>
      this.snsClient.send(new SetSMSAttributesCommand({
        attributes: { [key]: value }
      }))
    );

    return Promise.all(promises);
  }

  async getSMSAttributes() {
    return this.snsClient.send(new GetSMSAttributesCommand({}));
  }

  async setDefaultSenderName(senderName: string) {
    return this.setSMSAttributes({
      'DefaultSenderID': senderName
    });
  }

  async setDefaultSMSType(smsType: 'Promotional' | 'Transactional') {
    return this.setSMSAttributes({
      'DefaultSMSType': smsType
    });
  }

  async setMonthlySpendLimit(limitUSD: string) {
    return this.setSMSAttributes({
      'MonthlySpendLimit': limitUSD
    });
  }
}
```

## Advanced Usage

### Message Filtering Service

```typescript
@Injectable()
export class SnsFilteringService {
  constructor(private snsClient: SNSClient) {}

  async subscribeWithFilter(
    topicArn: string,
    protocol: string,
    endpoint: string,
    filterPolicy: any
  ) {
    const subscribeResult = await this.snsClient.send(new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: protocol,
      Endpoint: endpoint
    }));

    if (subscribeResult.SubscriptionArn && filterPolicy) {
      await this.snsClient.send(new SetSubscriptionAttributesCommand({
        SubscriptionArn: subscribeResult.SubscriptionArn,
        AttributeName: 'FilterPolicy',
        AttributeValue: JSON.stringify(filterPolicy)
      }));
    }

    return subscribeResult;
  }

  async updateFilterPolicy(subscriptionArn: string, filterPolicy: any) {
    const params = {
      SubscriptionArn: subscriptionArn,
      AttributeName: 'FilterPolicy',
      AttributeValue: JSON.stringify(filterPolicy)
    };

    return this.snsClient.send(new SetSubscriptionAttributesCommand(params));
  }

  async publishWithAttributes(
    topicArn: string,
    message: string,
    attributes: { [key: string]: string | number | boolean }
  ) {
    const messageAttributes: any = {};

    Object.entries(attributes).forEach(([key, value]) => {
      messageAttributes[key] = {
        DataType: typeof value === 'number' ? 'Number' : 'String',
        StringValue: value.toString()
      };
    });

    const params = {
      TopicArn: topicArn,
      Message: message,
      MessageAttributes: messageAttributes
    };

    return this.snsClient.send(new PublishCommand(params));
  }
}
```

### Event-Driven Notification Service

```typescript
interface NotificationEvent {
  type: 'user.signup' | 'order.created' | 'payment.failed' | 'system.alert';
  userId?: string;
  orderId?: string;
  data: any;
  timestamp: string;
}

@Injectable()
export class SnsEventNotificationService {
  constructor(private snsClient: SNSClient) {}

  async publishEvent(topicArn: string, event: NotificationEvent) {
    const messageAttributes = {
      'event.type': {
        DataType: 'String',
        StringValue: event.type
      },
      'event.timestamp': {
        DataType: 'String',
        StringValue: event.timestamp
      }
    };

    if (event.userId) {
      messageAttributes['event.userId'] = {
        DataType: 'String',
        StringValue: event.userId
      };
    }

    if (event.orderId) {
      messageAttributes['event.orderId'] = {
        DataType: 'String',
        StringValue: event.orderId
      };
    }

    const params = {
      TopicArn: topicArn,
      Message: JSON.stringify(event),
      Subject: `Event: ${event.type}`,
      MessageAttributes: messageAttributes
    };

    return this.snsClient.send(new PublishCommand(params));
  }

  async publishUserSignupEvent(topicArn: string, userId: string, userData: any) {
    const event: NotificationEvent = {
      type: 'user.signup',
      userId,
      data: userData,
      timestamp: new Date().toISOString()
    };

    return this.publishEvent(topicArn, event);
  }

  async publishOrderEvent(topicArn: string, orderId: string, userId: string, orderData: any) {
    const event: NotificationEvent = {
      type: 'order.created',
      userId,
      orderId,
      data: orderData,
      timestamp: new Date().toISOString()
    };

    return this.publishEvent(topicArn, event);
  }

  async publishSystemAlert(topicArn: string, alertData: any) {
    const event: NotificationEvent = {
      type: 'system.alert',
      data: alertData,
      timestamp: new Date().toISOString()
    };

    return this.publishEvent(topicArn, event);
  }
}
```

## Best Practices

### 1. Error Handling

```typescript
async safeSnsOperation<T>(operation: () => Promise<T>): Promise<T | null> {
  try {
    return await operation();
  } catch (error: any) {
    if (error.name === 'NotFound') {
      console.warn('SNS resource not found');
      return null;
    } else if (error.name === 'InvalidParameter') {
      console.error('Invalid SNS parameter:', error.message);
      throw new Error('Invalid SNS parameter');
    } else {
      console.error('SNS operation failed:', error);
      throw error;
    }
  }
}
```

### 2. Message Size Optimization

```typescript
validateMessageSize(message: string): boolean {
  // SNS has a 256KB limit for messages
  const sizeInBytes = Buffer.byteLength(message, 'utf8');
  const maxSize = 256 * 1024; // 256KB
  
  if (sizeInBytes > maxSize) {
    throw new Error(`Message size (${sizeInBytes} bytes) exceeds SNS limit (${maxSize} bytes)`);
  }
  
  return true;
}
```

### 3. Phone Number Validation

```typescript
validatePhoneNumber(phoneNumber: string): boolean {
  // E.164 format validation
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phoneNumber);
}
```

## Testing

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ServerAwsSnsModule } from '@onivoro/server-aws-sns';
import { SNSClient } from '@aws-sdk/client-sns';

describe('SNSClient', () => {
  let snsClient: SNSClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ServerAwsSnsModule.configure({
        AWS_REGION: 'us-east-1',
        AWS_PROFILE: 'test'
      })],
    }).compile();

    snsClient = module.get<SNSClient>(SNSClient);
  });

  it('should be defined', () => {
    expect(snsClient).toBeDefined();
  });
});
```

## API Reference

### Exported Classes
- `ServerAwsSnsConfig`: Configuration class for SNS settings
- `ServerAwsSnsModule`: NestJS module for SNS integration

### Exported Services
- `SNSClient`: AWS SNS client instance (from @aws-sdk/client-sns)

## License

This library is licensed under the MIT License. See the LICENSE file in this package for details.