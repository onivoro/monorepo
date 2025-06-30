# @onivoro/server-sendgrid

A comprehensive SendGrid email service integration library for NestJS applications, providing reliable email delivery, template management, and advanced email features with built-in configuration management and error handling.

## Installation

```bash
npm install @onivoro/server-sendgrid
```

## Features

- **SendGrid Integration**: Complete SendGrid API integration for email delivery
- **Email Service**: High-level email service with template support
- **NestJS Module**: Ready-to-use module with dependency injection
- **Configuration Management**: Strongly-typed configuration with environment variables
- **Template Support**: Dynamic and static template management
- **Attachment Handling**: Support for email attachments
- **Bulk Email**: Batch email sending capabilities
- **Error Handling**: Comprehensive error handling and retry logic
- **Type Safety**: Full TypeScript support with comprehensive type definitions

## Quick Start

### Import the Module

```typescript
import { ServerSendgridModule } from '@onivoro/server-sendgrid';

@Module({
  imports: [ServerSendgridModule],
})
export class AppModule {}
```

### Basic Configuration

```typescript
import { ServerSendgridConfig } from '@onivoro/server-sendgrid';

// Environment variables
// SENDGRID_API_KEY=your_sendgrid_api_key
// SENDGRID_FROM_EMAIL=noreply@yourcompany.com
// SENDGRID_FROM_NAME=Your Company Name
```

### Basic Email Sending

```typescript
import { Injectable } from '@nestjs/common';
import { EmailService } from '@onivoro/server-sendgrid';

@Injectable()
export class NotificationService {
  constructor(private emailService: EmailService) {}

  async sendWelcomeEmail(userEmail: string, userName: string): Promise<void> {
    await this.emailService.sendEmail({
      to: userEmail,
      subject: 'Welcome to Our Platform!',
      text: `Hello ${userName}, welcome to our platform!`,
      html: `<h1>Hello ${userName}</h1><p>Welcome to our platform!</p>`
    });
  }

  async sendPasswordResetEmail(userEmail: string, resetToken: string): Promise<void> {
    await this.emailService.sendEmail({
      to: userEmail,
      subject: 'Password Reset Request',
      templateId: 'd-1234567890abcdef', // SendGrid template ID
      dynamicTemplateData: {
        resetToken,
        resetUrl: `https://yourapp.com/reset-password?token=${resetToken}`
      }
    });
  }
}
```

## Configuration

### Environment Variables

```bash
# Required
SENDGRID_API_KEY=SG.your-sendgrid-api-key

# Sender Configuration
SENDGRID_FROM_EMAIL=noreply@yourcompany.com
SENDGRID_FROM_NAME=Your Company Name

# Optional
SENDGRID_REPLY_TO_EMAIL=support@yourcompany.com
SENDGRID_REPLY_TO_NAME=Support Team
SENDGRID_SANDBOX_MODE=false
SENDGRID_TRACKING=true
```

### Configuration Class

```typescript
import { ServerSendgridConfig, EnvironmentClass } from '@onivoro/server-sendgrid';

@EnvironmentClass()
export class CustomSendgridConfig extends ServerSendgridConfig {
  @EnvironmentVariable('CUSTOM_TEMPLATE_ID')
  customTemplateId: string;

  @EnvironmentVariable('ENABLE_EMAIL_NOTIFICATIONS', 'true')
  enableNotifications: boolean;
}
```

## Usage Examples

### Template Email with Dynamic Data

```typescript
import { Injectable } from '@nestjs/common';
import { EmailService } from '@onivoro/server-sendgrid';

@Injectable()
export class UserService {
  constructor(private emailService: EmailService) {}

  async sendOrderConfirmation(order: Order): Promise<void> {
    await this.emailService.sendEmail({
      to: order.customerEmail,
      subject: `Order Confirmation #${order.id}`,
      templateId: 'd-order-confirmation-template',
      dynamicTemplateData: {
        orderNumber: order.id,
        customerName: order.customerName,
        items: order.items,
        total: order.total,
        estimatedDelivery: order.estimatedDelivery,
        trackingUrl: `https://yourstore.com/track/${order.id}`
      }
    });
  }

  async sendAccountVerification(user: User, verificationToken: string): Promise<void> {
    await this.emailService.sendEmail({
      to: user.email,
      subject: 'Please verify your account',
      templateId: 'd-account-verification-template',
      dynamicTemplateData: {
        firstName: user.firstName,
        verificationUrl: `https://yourapp.com/verify?token=${verificationToken}`,
        companyName: 'Your Company'
      },
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true }
      }
    });
  }
}
```

### Bulk Email Sending

```typescript
import { Injectable } from '@nestjs/common';
import { EmailService } from '@onivoro/server-sendgrid';

@Injectable()
export class MarketingService {
  constructor(private emailService: EmailService) {}

  async sendNewsletterToSubscribers(subscribers: Subscriber[], newsletterContent: any): Promise<void> {
    const batchSize = 1000; // SendGrid allows up to 1000 recipients per batch
    
    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);
      
      await this.emailService.sendBulkEmail({
        templateId: 'd-newsletter-template',
        from: {
          email: 'newsletter@yourcompany.com',
          name: 'Your Company Newsletter'
        },
        personalizations: batch.map(subscriber => ({
          to: [{ email: subscriber.email, name: subscriber.name }],
          dynamicTemplateData: {
            firstName: subscriber.firstName,
            preferences: subscriber.preferences,
            unsubscribeUrl: `https://yourapp.com/unsubscribe?token=${subscriber.unsubscribeToken}`,
            ...newsletterContent
          }
        }))
      });

      // Add delay between batches to respect rate limits
      if (i + batchSize < subscribers.length) {
        await this.delay(1000);
      }
    }
  }

  async sendPromotionalCampaign(campaign: Campaign): Promise<void> {
    const eligibleUsers = await this.getEligibleUsers(campaign.criteria);
    
    await this.emailService.sendBulkEmail({
      templateId: campaign.templateId,
      subject: campaign.subject,
      personalizations: eligibleUsers.map(user => ({
        to: [{ email: user.email, name: user.fullName }],
        dynamicTemplateData: {
          ...campaign.templateData,
          firstName: user.firstName,
          customOffers: this.getPersonalizedOffers(user),
          unsubscribeUrl: `https://yourapp.com/unsubscribe?token=${user.unsubscribeToken}`
        }
      })),
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true },
        subscriptionTracking: { enable: true }
      }
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Email with Attachments

```typescript
import { Injectable } from '@nestjs/common';
import { EmailService } from '@onivoro/server-sendgrid';
import { readFileSync } from 'fs';

@Injectable()
export class DocumentService {
  constructor(private emailService: EmailService) {}

  async sendInvoiceEmail(invoice: Invoice): Promise<void> {
    const pdfBuffer = await this.generateInvoicePDF(invoice);
    
    await this.emailService.sendEmail({
      to: invoice.customerEmail,
      subject: `Invoice #${invoice.number}`,
      html: `
        <h2>Invoice #${invoice.number}</h2>
        <p>Dear ${invoice.customerName},</p>
        <p>Please find your invoice attached.</p>
        <p>Amount Due: $${invoice.total}</p>
        <p>Due Date: ${invoice.dueDate}</p>
      `,
      attachments: [
        {
          content: pdfBuffer.toString('base64'),
          filename: `invoice-${invoice.number}.pdf`,
          type: 'application/pdf',
          disposition: 'attachment',
          contentId: 'invoice'
        }
      ]
    });
  }

  async sendReportEmail(report: Report, recipients: string[]): Promise<void> {
    const csvData = await this.generateCSVReport(report);
    const chartImage = await this.generateChartImage(report);

    await this.emailService.sendEmail({
      to: recipients,
      subject: `${report.title} - ${new Date().toLocaleDateString()}`,
      html: `
        <h2>${report.title}</h2>
        <p>Please find the attached report and chart.</p>
        <img src="cid:chart" alt="Report Chart" style="max-width: 600px;">
      `,
      attachments: [
        {
          content: csvData.toString('base64'),
          filename: `${report.title.toLowerCase().replace(/\s+/g, '-')}.csv`,
          type: 'text/csv',
          disposition: 'attachment'
        },
        {
          content: chartImage.toString('base64'),
          filename: 'chart.png',
          type: 'image/png',
          disposition: 'inline',
          contentId: 'chart'
        }
      ]
    });
  }
}
```

### Transactional Email Service

```typescript
import { Injectable } from '@nestjs/common';
import { EmailService } from '@onivoro/server-sendgrid';

@Injectable()
export class TransactionalEmailService {
  constructor(private emailService: EmailService) {}

  async sendPasswordResetEmail(user: User, resetToken: string): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    await this.emailService.sendEmail({
      to: user.email,
      subject: 'Reset Your Password',
      templateId: 'd-password-reset-template',
      dynamicTemplateData: {
        firstName: user.firstName,
        resetUrl,
        expirationTime: '1 hour'
      },
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: false } // Privacy consideration
      }
    });
  }

  async sendTwoFactorCodeEmail(user: User, code: string): Promise<void> {
    await this.emailService.sendEmail({
      to: user.email,
      subject: 'Your Security Code',
      templateId: 'd-two-factor-code-template',
      dynamicTemplateData: {
        firstName: user.firstName,
        securityCode: code,
        expirationMinutes: 5
      },
      trackingSettings: {
        clickTracking: { enable: false },
        openTracking: { enable: false }
      }
    });
  }

  async sendAccountLockedEmail(user: User): Promise<void> {
    await this.emailService.sendEmail({
      to: user.email,
      subject: 'Account Security Alert',
      templateId: 'd-account-locked-template',
      dynamicTemplateData: {
        firstName: user.firstName,
        lockTime: new Date().toISOString(),
        supportEmail: 'support@yourcompany.com',
        unlockUrl: `${process.env.FRONTEND_URL}/unlock-account`
      }
    });
  }

  async sendPaymentFailedEmail(user: User, payment: Payment): Promise<void> {
    await this.emailService.sendEmail({
      to: user.email,
      subject: 'Payment Failed - Action Required',
      templateId: 'd-payment-failed-template',
      dynamicTemplateData: {
        firstName: user.firstName,
        amount: payment.amount,
        currency: payment.currency,
        failureReason: payment.failureReason,
        retryUrl: `${process.env.FRONTEND_URL}/billing/retry-payment/${payment.id}`,
        updatePaymentUrl: `${process.env.FRONTEND_URL}/billing/payment-methods`
      }
    });
  }
}
```

### Email Template Management

```typescript
import { Injectable } from '@nestjs/common';
import { EmailService } from '@onivoro/server-sendgrid';

@Injectable()
export class EmailTemplateService {
  private templates = {
    welcome: 'd-welcome-template-id',
    passwordReset: 'd-password-reset-template-id',
    orderConfirmation: 'd-order-confirmation-template-id',
    newsletter: 'd-newsletter-template-id'
  };

  constructor(private emailService: EmailService) {}

  async sendTemplateEmail(
    templateName: keyof typeof this.templates,
    recipient: string,
    data: Record<string, any>,
    options?: any
  ): Promise<void> {
    const templateId = this.templates[templateName];
    
    if (!templateId) {
      throw new Error(`Template ${templateName} not found`);
    }

    await this.emailService.sendEmail({
      to: recipient,
      templateId,
      dynamicTemplateData: data,
      ...options
    });
  }

  async sendWelcomeEmail(user: User): Promise<void> {
    await this.sendTemplateEmail('welcome', user.email, {
      firstName: user.firstName,
      activationUrl: `${process.env.FRONTEND_URL}/activate/${user.activationToken}`,
      supportEmail: 'support@yourcompany.com'
    });
  }

  async testTemplate(templateName: string, testEmail: string): Promise<void> {
    const testData = this.getTestDataForTemplate(templateName);
    
    await this.sendTemplateEmail(
      templateName as keyof typeof this.templates,
      testEmail,
      testData,
      {
        subject: `[TEST] ${templateName} Template`,
        sandboxMode: true
      }
    );
  }

  private getTestDataForTemplate(templateName: string): Record<string, any> {
    const testData = {
      welcome: {
        firstName: 'John',
        activationUrl: 'https://example.com/activate/test-token',
        supportEmail: 'support@yourcompany.com'
      },
      passwordReset: {
        firstName: 'Jane',
        resetUrl: 'https://example.com/reset/test-token',
        expirationTime: '1 hour'
      }
      // Add more test data as needed
    };

    return testData[templateName] || {};
  }
}
```

### Error Handling and Monitoring

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '@onivoro/server-sendgrid';

@Injectable()
export class ReliableEmailService {
  private readonly logger = new Logger(ReliableEmailService.name);

  constructor(private emailService: EmailService) {}

  async sendEmailWithRetry(
    emailData: any,
    maxRetries: number = 3
  ): Promise<void> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.emailService.sendEmail(emailData);
        
        this.logger.log(`Email sent successfully on attempt ${attempt}`, {
          recipient: emailData.to,
          subject: emailData.subject
        });
        
        return;
      } catch (error) {
        lastError = error;
        
        this.logger.warn(`Email send attempt ${attempt} failed`, {
          recipient: emailData.to,
          subject: emailData.subject,
          error: error.message,
          statusCode: error.response?.status
        });

        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    this.logger.error('Email send failed after all retries', {
      recipient: emailData.to,
      subject: emailData.subject,
      error: lastError.message,
      maxRetries
    });

    throw lastError;
  }

  async sendCriticalEmail(emailData: any): Promise<void> {
    try {
      await this.sendEmailWithRetry(emailData, 5);
    } catch (error) {
      // Log to external monitoring service
      await this.alertMonitoringService({
        type: 'critical_email_failure',
        emailData,
        error: error.message
      });
      
      throw error;
    }
  }

  private async alertMonitoringService(alert: any): Promise<void> {
    // Implementation for external monitoring/alerting
  }
}
```

## API Reference

### EmailService

Main service for sending emails:

```typescript
@Injectable()
export class EmailService {
  async sendEmail(emailData: EmailData): Promise<void>
  async sendBulkEmail(bulkEmailData: BulkEmailData): Promise<void>
  async sendTemplateEmail(templateData: TemplateEmailData): Promise<void>
}
```

### Configuration

#### ServerSendgridConfig

Configuration class for SendGrid settings:

```typescript
@EnvironmentClass()
export class ServerSendgridConfig {
  @EnvironmentVariable('SENDGRID_API_KEY')
  apiKey: string;

  @EnvironmentVariable('SENDGRID_FROM_EMAIL')
  fromEmail: string;

  @EnvironmentVariable('SENDGRID_FROM_NAME')
  fromName: string;

  @EnvironmentVariable('SENDGRID_REPLY_TO_EMAIL')
  replyToEmail?: string;

  @EnvironmentVariable('SENDGRID_SANDBOX_MODE', 'false')
  sandboxMode: boolean;
}
```

### Type Definitions

#### EmailData

Basic email data structure:

```typescript
interface EmailData {
  to: string | string[];
  subject?: string;
  text?: string;
  html?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, any>;
  attachments?: Attachment[];
  from?: EmailAddress;
  replyTo?: EmailAddress;
  trackingSettings?: TrackingSettings;
  sandboxMode?: boolean;
}
```

#### BulkEmailData

Bulk email data structure:

```typescript
interface BulkEmailData {
  templateId: string;
  from?: EmailAddress;
  subject?: string;
  personalizations: Personalization[];
  trackingSettings?: TrackingSettings;
  sandboxMode?: boolean;
}
```

#### Attachment

Email attachment structure:

```typescript
interface Attachment {
  content: string;        // Base64 encoded content
  filename: string;
  type: string;          // MIME type
  disposition: 'attachment' | 'inline';
  contentId?: string;    // For inline attachments
}
```

## Best Practices

1. **Environment Variables**: Store API keys securely using environment variables
2. **Template Management**: Use SendGrid templates for consistent branding
3. **Error Handling**: Implement retry logic for failed email sends
4. **Rate Limiting**: Respect SendGrid's rate limits for bulk operations
5. **Testing**: Use sandbox mode for testing email functionality
6. **Monitoring**: Monitor email delivery rates and failures
7. **Personalization**: Use dynamic template data for personalized emails
8. **Compliance**: Ensure compliance with email regulations (CAN-SPAM, GDPR)

## Testing

```typescript
import { Test } from '@nestjs/testing';
import { ServerSendgridModule, EmailService } from '@onivoro/server-sendgrid';

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [ServerSendgridModule],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should send email successfully', async () => {
    const emailData = {
      to: 'test@example.com',
      subject: 'Test Email',
      text: 'This is a test email'
    };

    await expect(service.sendEmail(emailData)).resolves.not.toThrow();
  });

  it('should send template email', async () => {
    const templateData = {
      to: 'test@example.com',
      templateId: 'd-test-template',
      dynamicTemplateData: {
        name: 'Test User'
      }
    };

    await expect(service.sendEmail(templateData)).resolves.not.toThrow();
  });
});
```

## License

This library is part of the Onivoro monorepo ecosystem.