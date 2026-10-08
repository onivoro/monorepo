# @onivoro/server-aws-credential-providers

AWS credential management for NestJS applications with profile support.

## Installation

```bash
npm install @onivoro/server-aws-credential-providers @aws-sdk/credential-providers @nestjs/common
```

`@aws-sdk/credential-providers` and `@nestjs/common` are peer dependencies.

## Overview

This library resolves AWS credentials from a named profile (via the AWS SDK's `fromIni`) and registers them as an injectable `AwsCredentials` provider. When no profile is configured, the provider resolves to `undefined`, so AWS SDK clients built with it fall back to the SDK's default credential provider chain (environment variables, shared files, SSO, container/instance roles, and so on).

It is used by the other `@onivoro/server-aws-*` packages (for example [`@onivoro/server-aws-ecs`](../aws-ecs/)).

## Exports

| Export                                             | Kind                    | Description                                                                                         |
| -------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------- |
| `ServerAwsCredentialProvidersModule`               | NestJS module           | `configure(config)` registers and exports `AwsCredentials` and `ServerAwsCredentialProvidersConfig` |
| `ServerAwsCredentialProvidersConfig`               | class                   | `{ AWS_PROFILE?: string }`                                                                          |
| `AwsCredentials`                                   | class / injection token | `{ accessKeyId: string; secretAccessKey: string }`                                                  |
| `resolveAwsCredentialProvidersByProfile(profile?)` | function                | Resolves credentials for a profile; returns `Promise<AwsCredentials \| undefined>`                  |
| `awsClientProvider(ClientClass, config, extras?)`  | function                | Builds a NestJS factory provider for an AWS SDK v3 client                                           |

## Usage

### Module Setup

`configure` takes a config object (it is required, but `AWS_PROFILE` may be omitted):

```typescript
import { Module } from '@nestjs/common';
import { ServerAwsCredentialProvidersModule } from '@onivoro/server-aws-credential-providers';

@Module({
  imports: [
    ServerAwsCredentialProvidersModule.configure({
      AWS_PROFILE: process.env.AWS_PROFILE,
    }),
  ],
})
export class AppModule {}
```

The module exports two providers:

- `AwsCredentials`: the result of `resolveAwsCredentialProvidersByProfile(config.AWS_PROFILE)`, which may be `undefined`
- `ServerAwsCredentialProvidersConfig`: the config object you passed in

```typescript
import { Injectable } from '@nestjs/common';
import { AwsCredentials } from '@onivoro/server-aws-credential-providers';

@Injectable()
export class AwsService {
  // undefined when no AWS_PROFILE was configured (or it couldn't be resolved)
  constructor(private readonly credentials: AwsCredentials) {}
}
```

### Configuration

```typescript
export class ServerAwsCredentialProvidersConfig {
  AWS_PROFILE?: string; // Optional: profile name from ~/.aws/credentials / ~/.aws/config
}
```

The module does not read `process.env` itself; pass values in through the config object.

### Credential Resolution

```typescript
import { resolveAwsCredentialProvidersByProfile } from '@onivoro/server-aws-credential-providers';

const credentials = await resolveAwsCredentialProvidersByProfile('my-profile');
// AwsCredentials | undefined
```

## How It Works

`resolveAwsCredentialProvidersByProfile(profile?)`:

1. **No profile given**: returns `undefined` immediately. It does not read `AWS_PROFILE` or any other environment variable.
2. **Profile given**: calls `fromIni({ profile })()` from `@aws-sdk/credential-providers` and returns the result. `fromIni` handles whatever the profile defines (static keys, session tokens, `role_arn`/`source_profile`, and so on), so the returned object can include extra fields such as `sessionToken` and `expiration`.
3. **Profile fails to load**: logs a warning, then falls back to environment variables:
   - `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` (uppercase), or else
   - `aws_access_key_id` + `aws_secret_access_key` (lowercase)
   - If neither pair is set, it returns `undefined`.

Environment variables are only a fallback for a profile that fails to load. They do not take precedence over a profile. The fallback reads only the key ID and secret, not `AWS_SESSION_TOKEN`.

Credentials are resolved once, when the provider is created. This library does not refresh them.

## Example

```typescript
import { Injectable } from '@nestjs/common';
import { resolveAwsCredentialProvidersByProfile, AwsCredentials } from '@onivoro/server-aws-credential-providers';

@Injectable()
export class AwsService {
  private credentials: AwsCredentials | undefined;

  async initialize() {
    // Pass the profile explicitly; with no argument the result is undefined
    this.credentials = await resolveAwsCredentialProvidersByProfile(process.env.AWS_PROFILE);
  }

  getCredentials(): AwsCredentials | undefined {
    return this.credentials;
  }
}
```

## AWS Configuration Files

`fromIni` reads the standard AWS shared files:

- `~/.aws/credentials`: AWS credentials file
- `~/.aws/config`: AWS configuration file

Example `~/.aws/credentials`:

```ini
[default]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

[production]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE2
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY2
```

If a profile fails to load, the warning reminds you that `aws_access_key_id` and `aws_secret_access_key` must be lowercase in the credentials file.

## AWS Client Provider Helper

`awsClientProvider` removes boilerplate when you register AWS SDK v3 clients as NestJS providers. It returns a factory provider whose token is the client class itself. The provider injects `AwsCredentials` and constructs the client as follows:

```typescript
new ClientClass({ region: config.AWS_REGION, credentials: credentials || undefined, ...extras });
```

Because `extras` is spread last, it can override `region` or `credentials`. When `AwsCredentials` is `undefined`, the client uses the SDK default credential chain.

Signature:

```typescript
function awsClientProvider<T>(ClientClass: new (config: any) => T, config: { AWS_REGION: string }, extras?: Record<string, any>): { provide: typeof ClientClass; useFactory: (credentials: AwsCredentials) => T; inject: [typeof AwsCredentials] };
```

### Basic usage

The `AwsCredentials` provider must be available, so import `ServerAwsCredentialProvidersModule` in the same module:

```typescript
import { Module } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import { awsClientProvider, ServerAwsCredentialProvidersModule } from '@onivoro/server-aws-credential-providers';

export class ServerAwsS3Config {
  AWS_REGION: string;
  AWS_PROFILE?: string;
}

@Module({})
export class ServerAwsS3Module {
  static configure(config: ServerAwsS3Config) {
    return {
      module: ServerAwsS3Module,
      imports: [ServerAwsCredentialProvidersModule.configure(config)],
      providers: [
        awsClientProvider(S3Client, config),
        S3Service, // your service that injects S3Client
      ],
      exports: [S3Client, S3Service],
    };
  }
}
```

### Multiple clients in one module

```typescript
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';

// ...
providers: [
  awsClientProvider(CloudWatchClient, config),
  awsClientProvider(CloudWatchLogsClient, config),
],
```

### Passing extra client options

The optional third argument passes extra properties to the client constructor:

```typescript
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';

// ...
providers: [
  awsClientProvider(CognitoIdentityProviderClient, config, {
    apiVersion: config.COGNITO_API_VERSION,
  }),
],
```

### Config requirements

`awsClientProvider` reads only `config.AWS_REGION`. `AWS_PROFILE` is read by `ServerAwsCredentialProvidersModule.configure`, so one config object with both fields serves both calls.

## Integration with AWS SDK

You can also use resolved credentials directly with AWS SDK v3:

```typescript
import { S3Client } from '@aws-sdk/client-s3';
import { resolveAwsCredentialProvidersByProfile } from '@onivoro/server-aws-credential-providers';

async function createS3Client() {
  const credentials = await resolveAwsCredentialProvidersByProfile(process.env.AWS_PROFILE);

  return new S3Client({
    region: 'us-east-1',
    credentials, // undefined -> SDK default credential chain
  });
}
```

## Notes

- Credentials are resolved once at startup and never refreshed. Temporary credentials from a profile (for example an assumed role) will expire.
- The `AwsCredentials` type declares only `accessKeyId` and `secretAccessKey`, even though `fromIni` may also return `sessionToken`/`expiration`.
- For long-running processes or more complex scenarios, leave `AWS_PROFILE` unset and let the AWS SDK's default credential chain handle resolution and refresh.

## License

MIT
