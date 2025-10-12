# @onivoro/server-sendgrid

A simple SendGrid integration module for NestJS applications, providing basic email sending functionality.

## Installation

```bash
npm install @onivoro/server-sendgrid @sendgrid/mail
```

## Overview

This library provides:
- NestJS module for SendGrid integration
- Basic email sending with attachments
- Simple configuration management
- Singleton SendGrid client instance

## Module Setup

```typescript
import { ServerSendgridModule, ServerSendgridConfig } from '@onivoro/server-sendgrid';

const config = new ServerSendgridConfig(
  process.env.SENDGRID_API_KEY,    // Your SendGrid API key
  'noreply@yourcompany.com'        // From email address
);

@Module({
  imports: [
    ServerSendgridModule.configure(config)
  ]
})
export class AppModule {}
```

## Configuration

The `ServerSendgridConfig` class requires two parameters:

```typescript
export class ServerSendgridConfig {
  constructor(
    public SENDGRID_API_KEY: string,  // SendGrid API key
    public FROM: string               // Default sender email
  ) {}
}
```

## Usage

### EmailService

The service provides a single method for sending emails:

```typescript
import { Injectable } from '@nestjs/common';
import { EmailService } from '@onivoro/server-sendgrid';

@Injectable()
export class NotificationService {
  constructor(private emailService: EmailService) {}

  async sendWelcomeEmail(userEmail: string, userName: string) {
    await this.emailService.sendEmail(
      userEmail,                                    // to
      'Welcome to Our Platform!',                   // subject
      `<h1>Hello ${userName}</h1><p>Welcome!</p>`, // html
      `Hello ${userName}, Welcome!`,               // text
      []                                           // attachments (optional)
    );
  }
}
```

## API Reference

### EmailService.sendEmail

```typescript
async sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
  attachments?: Array<{
    content: string;    // Base64 encoded content
    filename: string;
    type: string;      // MIME type
  }>
): Promise<any>
```

Parameters:
- `to` - Recipient email address
- `subject` - Email subject line
- `html` - HTML content of the email
- `text` - Plain text content of the email
- `attachments` - Optional array of attachments

## Complete Example

```typescript
import { Injectable } from '@nestjs/common';
import { EmailService } from '@onivoro/server-sendgrid';
import { readFileSync } from 'fs';

@Injectable()
export class InvoiceService {
  constructor(private emailService: EmailService) {}

  async sendInvoice(customerEmail: string, invoiceNumber: string, pdfPath: string) {
    const pdfContent = readFileSync(pdfPath).toString('base64');
    
    await this.emailService.sendEmail(
      customerEmail,
      `Invoice #${invoiceNumber}`,
      `
        <h2>Invoice #${invoiceNumber}</h2>
        <p>Please find your invoice attached.</p>
        <p>Thank you for your business!</p>
      `,
      `Invoice #${invoiceNumber}\n\nPlease find your invoice attached.\n\nThank you for your business!`,
      [{
        content: pdfContent,
        filename: `invoice-${invoiceNumber}.pdf`,
        type: 'application/pdf'
      }]
    );
  }

  async sendPasswordReset(userEmail: string, resetToken: string) {
    const resetUrl = `https://yourapp.com/reset-password?token=${resetToken}`;
    
    await this.emailService.sendEmail(
      userEmail,
      'Password Reset Request',
      `
        <p>You requested a password reset.</p>
        <p><a href="${resetUrl}">Click here to reset your password</a></p>
        <p>This link will expire in 1 hour.</p>
      `,
      `You requested a password reset.\n\nClick here to reset your password: ${resetUrl}\n\nThis link will expire in 1 hour.`
    );
  }
}
```

## Important Notes

1. This is a basic wrapper around SendGrid's mail service
2. The SendGrid client is initialized as a singleton
3. Only supports single recipient emails (no bulk sending)
4. The `FROM` address is configured globally for all emails
5. No template support - you must provide HTML and text content
6. Limited error handling - errors are thrown directly from SendGrid

## Limitations

- No dynamic templates
- No bulk email support
- No personalization features
- No advanced SendGrid features (tracking, scheduling, etc.)
- Single sender address for all emails

For more advanced features, consider using the SendGrid API directly or extending this service.

## License

MIT