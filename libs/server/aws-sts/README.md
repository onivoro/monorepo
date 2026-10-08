# @onivoro/server-aws-sts

AWS STS integration for NestJS applications.

## Installation

```bash
npm install @onivoro/server-aws-sts @aws-sdk/client-sts
```

## Overview

This library provides a minimal AWS STS (Security Token Service) integration for NestJS applications, offering account ID retrieval functionality.

## Module Setup

```typescript
import { Module } from '@nestjs/common';
import { ServerAwsStsModule } from '@onivoro/server-aws-sts';

@Module({
  imports: [
    ServerAwsStsModule.configure({
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
export class ServerAwsStsConfig {
  AWS_PROFILE?: string;
  AWS_REGION: string;
}
```

Credentials come from [`@onivoro/server-aws-credential-providers`](../aws-credential-providers/): when `AWS_PROFILE` is set the named profile is used, otherwise the AWS SDK default credential chain applies.

The module provides and exports `StsService`, an `STSClient`, and `ServerAwsStsConfig`.

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

- **`getAccountId(): Promise<string | undefined>`**: calls `GetCallerIdentityCommand` and returns `Account`.

## Direct Client Access

The service exposes the underlying client as the public `stsClient` property (you can also inject `STSClient` directly):

```typescript
import { Injectable } from '@nestjs/common';
import { StsService } from '@onivoro/server-aws-sts';
import { AssumeRoleCommand, GetSessionTokenCommand, GetAccessKeyInfoCommand, GetCallerIdentityCommand } from '@aws-sdk/client-sts';

@Injectable()
export class AdvancedStsService {
  constructor(private readonly stsService: StsService) {}

  // Assume a role
  async assumeRole(roleArn: string, sessionName: string) {
    const command = new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: sessionName,
      DurationSeconds: 3600, // 1 hour
    });

    const response = await this.stsService.stsClient.send(command);
    return response.Credentials;
  }

  // Get temporary session token
  async getSessionToken(durationSeconds: number = 3600) {
    const command = new GetSessionTokenCommand({
      DurationSeconds: durationSeconds,
    });

    const response = await this.stsService.stsClient.send(command);
    return response.Credentials;
  }

  // Get access key info
  async getAccessKeyInfo(accessKeyId: string) {
    const command = new GetAccessKeyInfoCommand({
      AccessKeyId: accessKeyId,
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
      userId: response.UserId,
    };
  }
}
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
import { AssumeRoleCommand } from '@aws-sdk/client-sts';

// Use the exposed stsClient for assume role operations
const assumeRoleCommand = new AssumeRoleCommand({
  RoleArn: `arn:aws:iam::${targetAccount}:role/${roleName}`,
  RoleSessionName: 'my-session',
});
const { Credentials } = await stsService.stsClient.send(assumeRoleCommand);
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
