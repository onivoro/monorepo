# @onivoro/server-aws-sts

AWS STS integration for NestJS applications.

## Installation

```bash
npm install @onivoro/server-aws-sts
```

## Overview

This library provides a minimal AWS STS (Security Token Service) integration for NestJS applications, offering account ID retrieval functionality.

## Module Setup

```typescript
import { Module } from '@nestjs/common';
import { ServerAwsStsModule } from '@onivoro/server-aws-sts';

@Module({
  imports: [
    ServerAwsStsModule.configure()
  ]
})
export class AppModule {}
```

## Configuration

The module uses environment-based configuration:

```typescript
export class ServerAwsStsConfig {
  AWS_REGION: string;
  AWS_PROFILE?: string;  // Optional AWS profile
}
```

## Service

### StsService

The service provides a single method for retrieving the AWS account ID:

```typescript
import { Injectable } from '@nestjs/common';
import { StsService } from '@onivoro/server-aws-sts';

@Injectable()
export class AccountService {
  constructor(private readonly stsService: StsService) {}

  async getCurrentAccountId() {
    const accountId = await this.stsService.getAccountId();
    console.log(`Current AWS Account: ${accountId}`);
    return accountId;
  }
}
```

## Available Method

- **getAccountId()** - Retrieves the AWS account ID for the current credentials

## Direct Client Access

The service exposes the underlying STS client for advanced operations:

```typescript
import { Injectable } from '@nestjs/common';
import { StsService } from '@onivoro/server-aws-sts';
import { 
  AssumeRoleCommand,
  GetSessionTokenCommand,
  GetAccessKeyInfoCommand
} from '@aws-sdk/client-sts';

@Injectable()
export class AdvancedStsService {
  constructor(private readonly stsService: StsService) {}

  // Assume a role
  async assumeRole(roleArn: string, sessionName: string) {
    const command = new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: sessionName,
      DurationSeconds: 3600 // 1 hour
    });
    
    const response = await this.stsService.stsClient.send(command);
    return response.Credentials;
  }

  // Get temporary session token
  async getSessionToken(durationSeconds: number = 3600) {
    const command = new GetSessionTokenCommand({
      DurationSeconds: durationSeconds
    });
    
    const response = await this.stsService.stsClient.send(command);
    return response.Credentials;
  }

  // Get access key info
  async getAccessKeyInfo(accessKeyId: string) {
    const command = new GetAccessKeyInfoCommand({
      AccessKeyId: accessKeyId
    });
    
    return await this.stsService.stsClient.send(command);
  }

  // Get caller identity (alternative to getAccountId)
  async getCallerIdentity() {
    const command = new GetCallerIdentityCommand({});
    const response = await this.stsService.stsClient.send(command);
    
    return {
      accountId: response.Account,
      arn: response.Arn,
      userId: response.UserId
    };
  }
}
```

## Complete Example

```typescript
import { Module, Injectable, Controller, Get, Post, Body } from '@nestjs/common';
import { ServerAwsStsModule, StsService } from '@onivoro/server-aws-sts';
import { AssumeRoleCommand } from '@aws-sdk/client-sts';

@Module({
  imports: [ServerAwsStsModule.configure()],
  controllers: [SecurityController],
  providers: [SecurityService]
})
export class SecurityModule {}

@Injectable()
export class SecurityService {
  constructor(private readonly stsService: StsService) {}

  async getCrossAccountCredentials(targetAccountId: string, roleName: string) {
    const currentAccountId = await this.stsService.getAccountId();
    const roleArn = `arn:aws:iam::${targetAccountId}:role/${roleName}`;
    const sessionName = `cross-account-${currentAccountId}-${Date.now()}`;

    const command = new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: sessionName,
      DurationSeconds: 3600,
      ExternalId: process.env.EXTERNAL_ID // If required by trust policy
    });

    try {
      const response = await this.stsService.stsClient.send(command);
      return {
        accessKeyId: response.Credentials.AccessKeyId,
        secretAccessKey: response.Credentials.SecretAccessKey,
        sessionToken: response.Credentials.SessionToken,
        expiration: response.Credentials.Expiration
      };
    } catch (error) {
      console.error('Failed to assume role:', error);
      throw error;
    }
  }

  async validateCurrentCredentials() {
    try {
      const accountId = await this.stsService.getAccountId();
      return {
        valid: true,
        accountId
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }
}

@Controller('security')
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Get('account')
  async getAccountInfo() {
    const accountId = await this.securityService.stsService.getAccountId();
    return { accountId };
  }

  @Get('validate')
  async validateCredentials() {
    return await this.securityService.validateCurrentCredentials();
  }

  @Post('assume-role')
  async assumeRole(@Body() body: {
    targetAccountId: string;
    roleName: string;
  }) {
    return await this.securityService.getCrossAccountCredentials(
      body.targetAccountId,
      body.roleName
    );
  }
}
```

## Environment Variables

```bash
# Required
AWS_REGION=us-east-1

# Optional
AWS_PROFILE=my-profile

# For cross-account access
EXTERNAL_ID=unique-external-id  # If required by role trust policy
```

## Common Use Cases

### 1. Account Verification
```typescript
const accountId = await stsService.getAccountId();
if (accountId !== expectedAccountId) {
  throw new Error('Running in wrong AWS account');
}
```

### 2. Dynamic Resource ARN Construction
```typescript
const accountId = await stsService.getAccountId();
const bucketArn = `arn:aws:s3:::my-bucket-${accountId}`;
```

### 3. Cross-Account Access Setup
```typescript
// Use the exposed stsClient for assume role operations
const assumeRoleCommand = new AssumeRoleCommand({
  RoleArn: `arn:aws:iam::${targetAccount}:role/${roleName}`,
  RoleSessionName: 'my-session'
});
const credentials = await stsService.stsClient.send(assumeRoleCommand);
```

## Limitations

- Only provides `getAccountId()` method out of the box
- No built-in support for role assumption or session tokens
- No credential caching or management
- For advanced STS operations, use the exposed `stsClient` directly

## Best Practices

1. **Credential Validation**: Use `getAccountId()` to verify you're in the correct AWS account
2. **Role Names**: Use descriptive role session names for audit trails
3. **Token Duration**: Request only the minimum token duration needed
4. **Error Handling**: Always handle STS errors appropriately
5. **Security**: Never log or expose temporary credentials

## License

MIT