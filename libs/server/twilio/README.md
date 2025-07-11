# @onivoro/server-twilio

A comprehensive Twilio integration library for NestJS applications, providing SMS messaging, voice calling, and communication services with built-in configuration management, error handling, and webhook support.

## Installation

```bash
npm install @onivoro/server-twilio
```

## Features

- **SMS Service**: Send SMS messages with delivery tracking
- **Twilio Service**: Complete Twilio API integration
- **Voice Calling**: Voice call management and automation
- **WhatsApp Integration**: WhatsApp Business API support
- **Webhook Handling**: Built-in webhook validation and processing
- **NestJS Module**: Ready-to-use module with dependency injection
- **Configuration Management**: Strongly-typed configuration with environment variables
- **Error Handling**: Comprehensive error handling and retry logic
- **Type Safety**: Full TypeScript support with Twilio SDK integration
- **Phone Number Validation**: Phone number formatting and validation utilities

## Quick Start

### Import the Module

```typescript
import { ApiTwilioModule } from '@onivoro/server-twilio';

@Module({
  imports: [ApiTwilioModule],
})
export class AppModule {}
```

### Basic Configuration

```typescript
import { ServerTwilioConfig } from '@onivoro/server-twilio';

// Environment variables
// TWILIO_ACCOUNT_SID=your_account_sid
// TWILIO_AUTH_TOKEN=your_auth_token
// TWILIO_PHONE_NUMBER=+1234567890
// TWILIO_WEBHOOK_URL=https://yourapp.com/webhooks/twilio
```

### Basic SMS Sending

```typescript
import { Injectable } from '@nestjs/common';
import { SmsService } from '@onivoro/server-twilio';

@Injectable()
export class NotificationService {
  constructor(private smsService: SmsService) {}

  async sendWelcomeSms(phoneNumber: string, userName: string): Promise<void> {
    await this.smsService.sendSms({
      to: phoneNumber,
      body: `Welcome ${userName}! Thanks for joining our platform.`
    });
  }

  async sendVerificationCode(phoneNumber: string, code: string): Promise<void> {
    await this.smsService.sendSms({
      to: phoneNumber,
      body: `Your verification code is: ${code}. This code expires in 10 minutes.`
    });
  }
}
```

## Configuration

### Environment Variables

```bash
# Required
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token

# Phone Numbers
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890

# Webhooks
TWILIO_WEBHOOK_URL=https://yourapp.com/webhooks/twilio
TWILIO_WEBHOOK_SECRET=your_webhook_secret

# Optional
TWILIO_APPLICATION_SID=APxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY_SID=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY_SECRET=your_api_key_secret
```

### Configuration Class

```typescript
import { ServerTwilioConfig, EnvironmentClass } from '@onivoro/server-twilio';

@EnvironmentClass()
export class CustomTwilioConfig extends ServerTwilioConfig {
  @EnvironmentVariable('TWILIO_ACCOUNT_SID')
  accountSid: string;

  @EnvironmentVariable('TWILIO_AUTH_TOKEN')
  authToken: string;

  @EnvironmentVariable('TWILIO_PHONE_NUMBER')
  phoneNumber: string;

  @EnvironmentVariable('TWILIO_WEBHOOK_SECRET')
  webhookSecret?: string;
}
```

## Usage Examples

### Advanced SMS Features

```typescript
import { Injectable } from '@nestjs/common';
import { SmsService, TwilioService } from '@onivoro/server-twilio';

@Injectable()
export class AdvancedSmsService {
  constructor(
    private smsService: SmsService,
    private twilioService: TwilioService
  ) {}

  async sendScheduledSms(
    phoneNumber: string,
    message: string,
    sendAt: Date
  ): Promise<string> {
    const response = await this.smsService.sendSms({
      to: phoneNumber,
      body: message,
      sendAt: sendAt.toISOString()
    });

    return response.sid;
  }

  async sendSmsWithMedia(
    phoneNumber: string,
    message: string,
    mediaUrls: string[]
  ): Promise<void> {
    await this.smsService.sendSms({
      to: phoneNumber,
      body: message,
      mediaUrl: mediaUrls
    });
  }

  async sendBulkSms(recipients: Array<{phone: string, message: string}>): Promise<void> {
    const promises = recipients.map(recipient =>
      this.smsService.sendSms({
        to: recipient.phone,
        body: recipient.message
      })
    );

    await Promise.all(promises);
  }

  async getSmsStatus(messageSid: string): Promise<any> {
    return this.twilioService.client.messages(messageSid).fetch();
  }

  async getSmsDeliveryReport(messageSid: string): Promise<any> {
    const message = await this.twilioService.client.messages(messageSid).fetch();
    
    return {
      sid: message.sid,
      status: message.status,
      errorCode: message.errorCode,
      errorMessage: message.errorMessage,
      dateCreated: message.dateCreated,
      dateSent: message.dateSent,
      dateUpdated: message.dateUpdated,
      price: message.price,
      priceUnit: message.priceUnit
    };
  }
}
```

### Voice Call Management

```typescript
import { Injectable } from '@nestjs/common';
import { TwilioService } from '@onivoro/server-twilio';

@Injectable()
export class VoiceService {
  constructor(private twilioService: TwilioService) {}

  async makeCall(
    toNumber: string,
    twimlUrl: string
  ): Promise<string> {
    const call = await this.twilioService.client.calls.create({
      to: toNumber,
      from: process.env.TWILIO_PHONE_NUMBER,
      url: twimlUrl,
      method: 'POST'
    });

    return call.sid;
  }

  async makeCallWithText(
    toNumber: string,
    message: string
  ): Promise<string> {
    const twiml = this.generateTwiML(message);
    
    const call = await this.twilioService.client.calls.create({
      to: toNumber,
      from: process.env.TWILIO_PHONE_NUMBER,
      twiml: twiml
    });

    return call.sid;
  }

  async getCallStatus(callSid: string): Promise<any> {
    const call = await this.twilioService.client.calls(callSid).fetch();
    
    return {
      sid: call.sid,
      status: call.status,
      duration: call.duration,
      startTime: call.startTime,
      endTime: call.endTime,
      price: call.price,
      direction: call.direction
    };
  }

  async hangupCall(callSid: string): Promise<void> {
    await this.twilioService.client.calls(callSid).update({
      status: 'completed'
    });
  }

  private generateTwiML(message: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="alice">${message}</Say>
      </Response>`;
  }

  async createConferenceCall(
    participants: string[],
    conferenceName: string
  ): Promise<string> {
    const conference = await this.twilioService.client.conferences.create({
      friendlyName: conferenceName
    });

    // Add participants to conference
    for (const participant of participants) {
      await this.twilioService.client.calls.create({
        to: participant,
        from: process.env.TWILIO_PHONE_NUMBER,
        twiml: `<?xml version="1.0" encoding="UTF-8"?>
          <Response>
            <Dial>
              <Conference>${conferenceName}</Conference>
            </Dial>
          </Response>`
      });
    }

    return conference.sid;
  }
}
```

### WhatsApp Integration

```typescript
import { Injectable } from '@nestjs/common';
import { SmsService, TwilioService } from '@onivoro/server-twilio';

@Injectable()
export class WhatsAppService {
  constructor(
    private smsService: SmsService,
    private twilioService: TwilioService
  ) {}

  async sendWhatsAppMessage(
    toNumber: string,
    message: string
  ): Promise<void> {
    await this.smsService.sendSms({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${toNumber}`,
      body: message
    });
  }

  async sendWhatsAppTemplate(
    toNumber: string,
    templateName: string,
    templateData: Record<string, string>
  ): Promise<void> {
    // Format template message
    const message = this.formatTemplate(templateName, templateData);
    
    await this.sendWhatsAppMessage(toNumber, message);
  }

  async sendWhatsAppMedia(
    toNumber: string,
    message: string,
    mediaUrl: string
  ): Promise<void> {
    await this.smsService.sendSms({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${toNumber}`,
      body: message,
      mediaUrl: [mediaUrl]
    });
  }

  async sendWhatsAppLocation(
    toNumber: string,
    latitude: number,
    longitude: number,
    label?: string
  ): Promise<void> {
    const locationMessage = label 
      ? `📍 ${label}\nLatitude: ${latitude}\nLongitude: ${longitude}`
      : `📍 Location\nLatitude: ${latitude}\nLongitude: ${longitude}`;

    await this.sendWhatsAppMessage(toNumber, locationMessage);
  }

  private formatTemplate(templateName: string, data: Record<string, string>): string {
    const templates = {
      orderConfirmation: `🎉 Order Confirmed!\n\nHi {{customerName}},\n\nYour order #{{orderNumber}} has been confirmed.\nTotal: ${{total}}\n\nTrack your order: {{trackingUrl}}`,
      appointmentReminder: `📅 Appointment Reminder\n\nHi {{customerName}},\n\nReminder: You have an appointment on {{date}} at {{time}}.\n\nLocation: {{location}}\n\nReply CONFIRM to confirm or RESCHEDULE to reschedule.`
    };

    let template = templates[templateName] || templateName;
    
    Object.entries(data).forEach(([key, value]) => {
      template = template.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    return template;
  }
}
```

### Two-Factor Authentication

```typescript
import { Injectable } from '@nestjs/common';
import { TwilioService } from '@onivoro/server-twilio';

@Injectable()
export class TwoFactorService {
  constructor(private twilioService: TwilioService) {}

  async createVerifyService(serviceName: string): Promise<string> {
    const service = await this.twilioService.client.verify.v2.services.create({
      friendlyName: serviceName,
      codeLength: 6
    });

    return service.sid;
  }

  async sendVerificationCode(
    phoneNumber: string,
    serviceSid: string,
    channel: 'sms' | 'call' = 'sms'
  ): Promise<void> {
    await this.twilioService.client.verify.v2
      .services(serviceSid)
      .verifications
      .create({
        to: phoneNumber,
        channel: channel
      });
  }

  async verifyCode(
    phoneNumber: string,
    code: string,
    serviceSid: string
  ): Promise<boolean> {
    try {
      const verification = await this.twilioService.client.verify.v2
        .services(serviceSid)
        .verificationChecks
        .create({
          to: phoneNumber,
          code: code
        });

      return verification.status === 'approved';
    } catch (error) {
      return false;
    }
  }

  async sendCustomVerificationSms(phoneNumber: string): Promise<string> {
    const code = this.generateVerificationCode();
    
    const message = await this.twilioService.client.messages.create({
      body: `Your verification code is: ${code}. This code expires in 10 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });

    // Store code in cache/database for verification
    await this.storeVerificationCode(phoneNumber, code);

    return message.sid;
  }

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async storeVerificationCode(phoneNumber: string, code: string): Promise<void> {
    // Implementation depends on your storage solution
    // Could be Redis, database, etc.
  }
}
```

### Webhook Handling

```typescript
import { Controller, Post, Body, Headers, BadRequestException } from '@nestjs/common';
import { TwilioService } from '@onivoro/server-twilio';

@Controller('webhooks/twilio')
export class TwilioWebhookController {
  constructor(private twilioService: TwilioService) {}

  @Post('sms-status')
  async handleSmsStatus(
    @Body() body: any,
    @Headers('x-twilio-signature') signature: string
  ): Promise<void> {
    // Validate webhook signature
    const isValid = this.twilioService.validateWebhook(
      body,
      signature,
      process.env.TWILIO_WEBHOOK_URL
    );

    if (!isValid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    // Process SMS status update
    await this.processSmsStatus(body);
  }

  @Post('sms-reply')
  async handleSmsReply(
    @Body() body: any,
    @Headers('x-twilio-signature') signature: string
  ): Promise<void> {
    const isValid = this.twilioService.validateWebhook(
      body,
      signature,
      process.env.TWILIO_WEBHOOK_URL
    );

    if (!isValid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    await this.processSmsReply(body);
  }

  @Post('call-status')
  async handleCallStatus(
    @Body() body: any,
    @Headers('x-twilio-signature') signature: string
  ): Promise<void> {
    const isValid = this.twilioService.validateWebhook(
      body,
      signature,
      process.env.TWILIO_WEBHOOK_URL
    );

    if (!isValid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    await this.processCallStatus(body);
  }

  private async processSmsStatus(webhookData: any): Promise<void> {
    const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = webhookData;
    
    console.log(`SMS ${MessageSid} status: ${MessageStatus}`);
    
    if (ErrorCode) {
      console.error(`SMS error: ${ErrorCode} - ${ErrorMessage}`);
    }

    // Update your database or trigger business logic based on status
    await this.updateMessageStatus(MessageSid, MessageStatus, ErrorCode);
  }

  private async processSmsReply(webhookData: any): Promise<void> {
    const { From, Body, MessageSid } = webhookData;
    
    console.log(`Received SMS from ${From}: ${Body}`);
    
    // Process the incoming message
    await this.handleIncomingMessage(From, Body, MessageSid);
  }

  private async processCallStatus(webhookData: any): Promise<void> {
    const { CallSid, CallStatus, Duration } = webhookData;
    
    console.log(`Call ${CallSid} status: ${CallStatus}, Duration: ${Duration}`);
    
    // Update call records or trigger business logic
    await this.updateCallStatus(CallSid, CallStatus, Duration);
  }

  private async updateMessageStatus(messageSid: string, status: string, errorCode?: string): Promise<void> {
    // Implementation depends on your data storage
  }

  private async handleIncomingMessage(from: string, body: string, messageSid: string): Promise<void> {
    // Auto-responder logic
    const response = await this.generateAutoResponse(from, body);
    
    if (response) {
      await this.twilioService.client.messages.create({
        body: response,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: from
      });
    }
  }

  private async updateCallStatus(callSid: string, status: string, duration?: string): Promise<void> {
    // Implementation depends on your data storage
  }

  private async generateAutoResponse(from: string, message: string): Promise<string | null> {
    const lowerMessage = message.toLowerCase().trim();
    
    if (lowerMessage.includes('help')) {
      return 'Thank you for contacting us! For immediate assistance, please call our support line at 1-800-SUPPORT or visit our website.';
    }
    
    if (lowerMessage.includes('stop') || lowerMessage.includes('unsubscribe')) {
      // Handle opt-out
      await this.handleOptOut(from);
      return 'You have been unsubscribed from our messages. Reply START to resubscribe.';
    }
    
    if (lowerMessage.includes('start') || lowerMessage.includes('subscribe')) {
      // Handle opt-in
      await this.handleOptIn(from);
      return 'Welcome back! You will now receive messages from us.';
    }
    
    return null; // No auto-response
  }

  private async handleOptOut(phoneNumber: string): Promise<void> {
    // Implementation for opt-out logic
  }

  private async handleOptIn(phoneNumber: string): Promise<void> {
    // Implementation for opt-in logic
  }
}
```

### Phone Number Validation and Formatting

```typescript
import { Injectable } from '@nestjs/common';
import { TwilioService } from '@onivoro/server-twilio';

@Injectable()
export class PhoneValidationService {
  constructor(private twilioService: TwilioService) {}

  async validatePhoneNumber(phoneNumber: string): Promise<{
    valid: boolean;
    formatted: string;
    countryCode: string;
    carrier?: string;
    lineType?: string;
  }> {
    try {
      const lookup = await this.twilioService.client.lookups.v1
        .phoneNumbers(phoneNumber)
        .fetch({
          type: ['carrier'],
          countryCode: 'US'
        });

      return {
        valid: true,
        formatted: lookup.phoneNumber,
        countryCode: lookup.countryCode,
        carrier: lookup.carrier?.name,
        lineType: lookup.carrier?.type
      };
    } catch (error) {
      return {
        valid: false,
        formatted: phoneNumber,
        countryCode: 'unknown'
      };
    }
  }

  formatPhoneNumber(phoneNumber: string, countryCode: string = 'US'): string {
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    if (countryCode === 'US' && digits.length === 10) {
      return `+1${digits}`;
    }
    
    if (digits.startsWith('1') && digits.length === 11) {
      return `+${digits}`;
    }
    
    return phoneNumber; // Return as-is if can't format
  }

  async bulkValidatePhoneNumbers(phoneNumbers: string[]): Promise<Array<{
    input: string;
    valid: boolean;
    formatted: string;
    error?: string;
  }>> {
    const results = await Promise.allSettled(
      phoneNumbers.map(async (phone) => {
        const validation = await this.validatePhoneNumber(phone);
        return { input: phone, ...validation };
      })
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          input: phoneNumbers[index],
          valid: false,
          formatted: phoneNumbers[index],
          error: result.reason.message
        };
      }
    });
  }
}
```

## API Reference

### SmsService

Main service for SMS operations:

```typescript
@Injectable()
export class SmsService {
  async sendSms(smsData: SmsData): Promise<MessageInstance>
}
```

### TwilioService

Core Twilio service with full SDK access:

```typescript
@Injectable()
export class TwilioService {
  client: Twilio;
  
  validateWebhook(body: any, signature: string, url: string): boolean
}
```

### Configuration

#### ServerTwilioConfig

Configuration class for Twilio settings:

```typescript
@EnvironmentClass()
export class ServerTwilioConfig {
  @EnvironmentVariable('TWILIO_ACCOUNT_SID')
  accountSid: string;

  @EnvironmentVariable('TWILIO_AUTH_TOKEN')
  authToken: string;

  @EnvironmentVariable('TWILIO_PHONE_NUMBER')
  phoneNumber: string;

  @EnvironmentVariable('TWILIO_WEBHOOK_SECRET')
  webhookSecret?: string;
}
```

### Type Definitions

#### SmsData

SMS message data structure:

```typescript
interface SmsData {
  to: string;
  body: string;
  from?: string;
  mediaUrl?: string[];
  sendAt?: string;
  validityPeriod?: number;
  maxPrice?: string;
  statusCallback?: string;
}
```

## Best Practices

1. **Environment Variables**: Store credentials securely using environment variables
2. **Webhook Validation**: Always validate webhook signatures for security
3. **Error Handling**: Implement proper error handling for API calls
4. **Rate Limiting**: Respect Twilio's rate limits for API calls
5. **Phone Validation**: Validate phone numbers before sending messages
6. **Opt-out Handling**: Implement proper opt-out mechanisms for compliance
7. **Cost Monitoring**: Monitor usage to control costs
8. **Message Templates**: Use templates for consistent messaging

## Testing

```typescript
import { Test } from '@nestjs/testing';
import { ApiTwilioModule, SmsService } from '@onivoro/server-twilio';

describe('SmsService', () => {
  let service: SmsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [ApiTwilioModule],
    }).compile();

    service = module.get<SmsService>(SmsService);
  });

  it('should send SMS successfully', async () => {
    const smsData = {
      to: '+1234567890',
      body: 'Test message'
    };

    await expect(service.sendSms(smsData)).resolves.not.toThrow();
  });
});
```

## License

This library is licensed under the MIT License. See the LICENSE file in this package for details.