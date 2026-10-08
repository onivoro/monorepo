# @onivoro/server-twilio

A simple Twilio integration module for NestJS applications, providing basic SMS functionality and access to the Twilio client.

## Installation

```bash
npm install @onivoro/server-twilio twilio
```

`@nestjs/common` and `twilio` are peer dependencies; `@onivoro/server-common` is installed as a regular dependency.

## Overview

This library provides:

- NestJS module for Twilio integration
- Basic SMS sending functionality
- SMS message listing
- Direct access to the Twilio client for advanced operations

## Module Setup

```typescript
import { Module } from '@nestjs/common';
import { ServerTwilioModule, ServerTwilioConfig } from '@onivoro/server-twilio';

const config = new ServerTwilioConfig(
  process.env.TWILIO_ACCOUNT_SID!, // Your Twilio Account SID
  process.env.TWILIO_AUTH_TOKEN!, // Your Twilio Auth Token
  process.env.TWILIO_FROM!, // Your Twilio phone number (e.g., +1234567890)
);

@Module({
  imports: [ServerTwilioModule.configure(config)],
})
export class AppModule {}
```

`ServerTwilioModule.configure(config)` constructs one `Twilio` client immediately (when `configure()` is called) and returns a dynamic module (not global) that provides and exports `TwilioService`, `SmsService`, and the `Twilio` client. `ServerTwilioConfig` itself is not registered as a provider; read it from the public `twilioService.config` property if you need it.

## Configuration

The `ServerTwilioConfig` class requires three parameters:

```typescript
export class ServerTwilioConfig {
  constructor(
    public TWILIO_ACCOUNT_SID: string,
    public TWILIO_AUTH_TOKEN: string,
    public TWILIO_FROM: string, // Default sender phone number
  ) {}
}
```

## Services

### TwilioService

Basic SMS sending service:

```typescript
import { Injectable } from '@nestjs/common';
import { TwilioService } from '@onivoro/server-twilio';

@Injectable()
export class NotificationService {
  constructor(private twilioService: TwilioService) {}

  async sendNotification(phoneNumber: string, message: string) {
    try {
      await this.twilioService.sendSms(phoneNumber, message);
      console.log('SMS sent successfully');
    } catch (error) {
      console.error('Failed to send SMS:', error);
    }
  }
}
```

### SmsService

Service for listing SMS messages:

```typescript
import { Injectable } from '@nestjs/common';
import { SmsService } from '@onivoro/server-twilio';

@Injectable()
export class MessageService {
  constructor(private smsService: SmsService) {}

  async getRecentMessages(phoneNumber: string) {
    // Get last 50 messages sent to a phone number
    const messages = await this.smsService.index(phoneNumber, 50);
    return messages;
  }
}
```

### Direct Twilio Client Access

The package re-exports `Twilio` from `twilio`, and the module registers the client under that class as its injection token:

```typescript
import { Injectable } from '@nestjs/common';
import { Twilio, TwilioService } from '@onivoro/server-twilio';

@Injectable()
export class AdvancedTwilioService {
  constructor(
    private twilio: Twilio,
    private twilioService: TwilioService,
  ) {}

  async sendSmsWithMediaUrl(to: string, body: string, mediaUrl: string) {
    return await this.twilio.messages.create({
      body,
      from: this.twilioService.config.TWILIO_FROM,
      to,
      mediaUrl: [mediaUrl],
    });
  }

  async makeCall(to: string, twimlUrl: string) {
    return await this.twilio.calls.create({
      from: this.twilioService.config.TWILIO_FROM,
      to,
      url: twimlUrl,
    });
  }

  async getMessageStatus(messageSid: string) {
    return await this.twilio.messages(messageSid).fetch();
  }
}
```

## API Reference

### TwilioService.sendSms

```typescript
async sendSms(to: string, body: string): Promise<void>
```

Sends an SMS from `config.TWILIO_FROM`. On failure it logs `{ error, msg }` with `console.error` and re-throws the original error.

Parameters:

- `to` - Recipient phone number (E.164 format recommended, e.g., +1234567890)
- `body` - SMS message content

### SmsService.index

```typescript
async index(to: string, limit = 100): Promise<MessageInstance[]>
```

Lists messages sent to a specific phone number via `twilio.messages.list({ to, limit })`. Errors are not caught.

Parameters:

- `to` - Phone number to filter messages
- `limit` - Maximum number of messages to return (default: 100)

Returns: Array of Twilio MessageInstance objects

## Complete Example

```typescript
import { Injectable } from '@nestjs/common';
import { TwilioService, SmsService, Twilio } from '@onivoro/server-twilio';

@Injectable()
export class CommunicationService {
  constructor(
    private twilioService: TwilioService,
    private smsService: SmsService,
    private twilio: Twilio,
  ) {}

  async sendVerificationCode(phoneNumber: string, code: string) {
    const message = `Your verification code is: ${code}. This code expires in 10 minutes.`;
    await this.twilioService.sendSms(phoneNumber, message);
  }

  async sendWelcomeMessage(phoneNumber: string, userName: string) {
    const message = `Welcome ${userName}! Thanks for joining our platform. Reply STOP to unsubscribe.`;
    await this.twilioService.sendSms(phoneNumber, message);
  }

  async checkForVerificationCode(phoneNumber: string): Promise<string | null> {
    const messages = await this.smsService.index(phoneNumber, 10);

    // Look for recent messages containing verification code
    for (const message of messages) {
      const codeMatch = message.body.match(/\d{6}/);
      if (codeMatch && message.dateCreated > new Date(Date.now() - 10 * 60 * 1000)) {
        return codeMatch[0];
      }
    }

    return null;
  }

  async sendAppointmentReminder(phoneNumber: string, appointmentTime: Date) {
    // Using the Twilio client directly for scheduled messages.
    // Twilio requires a Messaging Service (not a `from` number) for scheduling,
    // and sendAt must be between 15 minutes and 35 days in the future.
    const sendAt = new Date(appointmentTime.getTime() - 60 * 60 * 1000); // 1 hour before

    await this.twilio.messages.create({
      body: `Reminder: You have an appointment at ${appointmentTime.toLocaleString()}`,
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
      to: phoneNumber,
      scheduleType: 'fixed',
      sendAt: sendAt,
    });
  }
}
```

## Error Handling

`TwilioService.sendSms` logs and re-throws errors; `SmsService.index` lets errors propagate unchanged:

```typescript
try {
  await this.twilioService.sendSms(phoneNumber, message);
} catch (error) {
  // Error is logged to console with context
  // Original error is re-thrown
  // Handle specific Twilio errors:
  if (error.code === 21211) {
    // Invalid phone number
  } else if (error.code === 21608) {
    // Unverified phone number (trial account)
  }
}
```

## Important Notes

1. Phone numbers should be in E.164 format (e.g., +1234567890)
2. The `TWILIO_FROM` number must be a Twilio phone number you own
3. Trial accounts can only send SMS to verified phone numbers
4. Each `configure()` call creates a single Twilio client instance shared by both services
5. Error handling is basic - `sendSms` logs and re-throws; `index` does not catch

## Limitations

- No webhook support
- No template support
- No bulk SMS functionality
- No built-in rate limiting
- No retry logic
- Limited to basic SMS operations

For advanced features, use the injected Twilio client directly.

## License

MIT
