# @onivoro/server-aws-credential-providers

AWS credential management for NestJS applications with profile support.

## Installation

```bash
npm install @onivoro/server-aws-credential-providers
```

## Overview

This library provides a simple AWS credential resolution system for NestJS applications. It resolves AWS credentials from either environment variables or AWS profile configuration.

## Usage

### Module Setup

Import and configure the module in your NestJS application:

```typescript
import { ServerAwsCredentialProvidersModule } from '@onivoro/server-aws-credential-providers';

@Module({
  imports: [
    ServerAwsCredentialProvidersModule.configure()
  ]
})
export class AppModule {}
```

### Configuration

The module uses environment-based configuration:

```typescript
export class ServerAwsCredentialProvidersConfig {
  AWS_PROFILE?: string;  // Optional: AWS profile name from ~/.aws/credentials
}
```

### Credential Resolution

The module provides a function to resolve AWS credentials:

```typescript
import { resolveAwsCredentialProvidersByProfile } from '@onivoro/server-aws-credential-providers';

// Resolve credentials based on profile
const credentials = await resolveAwsCredentialProvidersByProfile('my-profile');

// credentials will have:
// {
//   accessKeyId: string,
//   secretAccessKey: string
// }
```

### AWS Credentials Class

The library exports a simple credentials class:

```typescript
import { AwsCredentials } from '@onivoro/server-aws-credential-providers';

const creds: AwsCredentials = {
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
};
```

## How It Works

The credential resolution follows this priority:

1. **Environment Variables**: If `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are set, these are used
2. **AWS Profile**: If an AWS profile is specified (via `AWS_PROFILE` env var or parameter), credentials are loaded from the AWS credentials file

## Example

```typescript
import { Injectable } from '@nestjs/common';
import { 
  resolveAwsCredentialProvidersByProfile,
  AwsCredentials 
} from '@onivoro/server-aws-credential-providers';

@Injectable()
export class AwsService {
  private credentials: AwsCredentials;

  async initialize() {
    // Use default profile from AWS_PROFILE env var
    this.credentials = await resolveAwsCredentialProvidersByProfile();
    
    // Or specify a profile explicitly
    // this.credentials = await resolveAwsCredentialProvidersByProfile('production');
  }

  getCredentials(): AwsCredentials {
    return this.credentials;
  }
}
```

## Environment Variables

```bash
# Optional: Specify AWS profile to use
AWS_PROFILE=my-profile

# Direct credentials (takes precedence over profile)
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

## AWS Configuration Files

The module reads from standard AWS configuration files:

- `~/.aws/credentials` - AWS credentials file
- `~/.aws/config` - AWS configuration file

Example `~/.aws/credentials`:
```ini
[default]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

[production]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE2
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY2
```

## Integration with AWS SDK

Use the resolved credentials with AWS SDK v3:

```typescript
import { S3Client } from '@aws-sdk/client-s3';
import { resolveAwsCredentialProvidersByProfile } from '@onivoro/server-aws-credential-providers';

async function createS3Client() {
  const credentials = await resolveAwsCredentialProvidersByProfile();
  
  return new S3Client({
    region: 'us-east-1',
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey
    }
  });
}
```

## Notes

- This is a simple credential provider that doesn't support advanced features like:
  - Session tokens
  - AssumeRole operations
  - Credential refresh
  - MFA authentication
- For more complex credential scenarios, consider using AWS SDK's built-in credential providers directly

## License

MIT