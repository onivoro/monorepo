# @onivoro/server-aws-credential-providers

A NestJS module for managing AWS credential providers with support for multiple AWS profiles, credential resolution, and secure credential management for server-side applications.

## Installation

```bash
npm install @onivoro/server-aws-credential-providers
```

## Features

- **Multi-Profile Support**: Manage multiple AWS profiles (dev, staging, production)
- **Credential Resolution**: Automatic credential resolution from various sources
- **Profile-Based Configuration**: Profile-specific credential providers
- **Environment Integration**: Seamless integration with AWS environment configurations
- **Secure Credential Management**: Safe handling of AWS credentials

## Quick Start

### 1. Module Configuration

```typescript
import { ServerAwsCredentialProvidersModule } from '@onivoro/server-aws-credential-providers';

@Module({
  imports: [
    ServerAwsCredentialProvidersModule.forRoot({
      profiles: {
        development: {
          region: 'us-east-1',
          accessKeyId: process.env.AWS_DEV_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_DEV_SECRET_ACCESS_KEY,
        },
        production: {
          region: 'us-west-2',
          accessKeyId: process.env.AWS_PROD_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_PROD_SECRET_ACCESS_KEY,
        }
      },
      defaultProfile: 'development'
    }),
  ],
})
export class AppModule {}
```

### 2. Using AWS Credentials

```typescript
import { AwsCredentials } from '@onivoro/server-aws-credential-providers';

@Injectable()
export class S3Service {
  constructor(private awsCredentials: AwsCredentials) {}

  async getS3Client(profile: string = 'development') {
    const credentials = await this.awsCredentials.getCredentials(profile);
    
    return new S3Client({
      region: credentials.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      }
    });
  }
}
```

## Configuration

### ServerAwsCredentialProvidersConfig

```typescript
import { ServerAwsCredentialProvidersConfig } from '@onivoro/server-aws-credential-providers';

export class AppAwsCredentialsConfig extends ServerAwsCredentialProvidersConfig {
  profiles = {
    development: {
      region: process.env.AWS_DEV_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_DEV_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_DEV_SECRET_ACCESS_KEY,
      roleArn: process.env.AWS_DEV_ROLE_ARN,
    },
    staging: {
      region: process.env.AWS_STAGING_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_STAGING_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_STAGING_SECRET_ACCESS_KEY,
      roleArn: process.env.AWS_STAGING_ROLE_ARN,
    },
    production: {
      region: process.env.AWS_PROD_REGION || 'us-west-2',
      accessKeyId: process.env.AWS_PROD_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_PROD_SECRET_ACCESS_KEY,
      roleArn: process.env.AWS_PROD_ROLE_ARN,
    }
  };
  defaultProfile = process.env.AWS_DEFAULT_PROFILE || 'development';
  credentialProviderTimeout = parseInt(process.env.AWS_CREDENTIAL_TIMEOUT) || 30000;
}
```

### Environment Variables

```bash
# Development Profile
AWS_DEV_REGION=us-east-1
AWS_DEV_ACCESS_KEY_ID=your-dev-access-key
AWS_DEV_SECRET_ACCESS_KEY=your-dev-secret-key
AWS_DEV_ROLE_ARN=arn:aws:iam::123456789012:role/DevRole

# Staging Profile
AWS_STAGING_REGION=us-east-1
AWS_STAGING_ACCESS_KEY_ID=your-staging-access-key
AWS_STAGING_SECRET_ACCESS_KEY=your-staging-secret-key
AWS_STAGING_ROLE_ARN=arn:aws:iam::123456789012:role/StagingRole

# Production Profile
AWS_PROD_REGION=us-west-2
AWS_PROD_ACCESS_KEY_ID=your-prod-access-key
AWS_PROD_SECRET_ACCESS_KEY=your-prod-secret-key
AWS_PROD_ROLE_ARN=arn:aws:iam::123456789012:role/ProdRole

# Default Settings
AWS_DEFAULT_PROFILE=development
AWS_CREDENTIAL_TIMEOUT=30000
```

## Core Classes

### AwsCredentials

Main service for managing AWS credentials:

```typescript
import { AwsCredentials } from '@onivoro/server-aws-credential-providers';

@Injectable()
export class CloudService {
  constructor(private awsCredentials: AwsCredentials) {}

  async getDynamoDBClient(profile?: string) {
    const credentials = await this.awsCredentials.getCredentials(profile);
    
    return new DynamoDBClient({
      region: credentials.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      }
    });
  }

  async assumeRole(roleArn: string, sessionName: string, profile?: string) {
    return this.awsCredentials.assumeRole({
      roleArn,
      sessionName,
      profile
    });
  }

  async getCredentialsForProfile(profileName: string) {
    return this.awsCredentials.getCredentials(profileName);
  }

  async refreshCredentials(profile?: string) {
    return this.awsCredentials.refreshCredentials(profile);
  }
}
```

## Utility Functions

### resolveAwsCredentialProvidersByProfile

Resolves credential providers for a specific profile:

```typescript
import { resolveAwsCredentialProvidersByProfile } from '@onivoro/server-aws-credential-providers';

// Resolve credentials for a specific profile
const credentialProvider = await resolveAwsCredentialProvidersByProfile('production');

// Use with AWS SDK clients
const s3Client = new S3Client({
  region: 'us-west-2',
  credentials: credentialProvider
});
```

## Advanced Usage

### Multi-Environment Service

```typescript
@Injectable()
export class MultiEnvironmentService {
  constructor(private awsCredentials: AwsCredentials) {}

  async deployToMultipleEnvironments(deploymentConfig: any) {
    const environments = ['development', 'staging', 'production'];
    const results = [];

    for (const env of environments) {
      try {
        console.log(`Deploying to ${env}...`);
        
        const credentials = await this.awsCredentials.getCredentials(env);
        const client = this.createClientForEnvironment(env, credentials);
        
        const result = await this.performDeployment(client, deploymentConfig);
        results.push({ environment: env, success: true, result });
        
        console.log(`✅ Successfully deployed to ${env}`);
      } catch (error) {
        console.error(`❌ Failed to deploy to ${env}:`, error.message);
        results.push({ 
          environment: env, 
          success: false, 
          error: error.message 
        });
      }
    }

    return results;
  }

  private createClientForEnvironment(environment: string, credentials: any) {
    // Create appropriate AWS service client based on environment
    switch (environment) {
      case 'development':
        return new S3Client({ region: 'us-east-1', credentials });
      case 'staging':
        return new S3Client({ region: 'us-east-1', credentials });
      case 'production':
        return new S3Client({ region: 'us-west-2', credentials });
      default:
        throw new Error(`Unknown environment: ${environment}`);
    }
  }

  private async performDeployment(client: any, config: any) {
    // Deployment logic here
    return { deploymentId: `deploy-${Date.now()}` };
  }
}
```

### Credential Caching Service

```typescript
@Injectable()
export class CredentialCacheService {
  private credentialCache = new Map<string, { credentials: any; expiry: Date }>();
  private readonly CACHE_DURATION = 50 * 60 * 1000; // 50 minutes

  constructor(private awsCredentials: AwsCredentials) {}

  async getCachedCredentials(profile: string = 'default') {
    const cacheKey = `credentials-${profile}`;
    const cached = this.credentialCache.get(cacheKey);

    if (cached && cached.expiry > new Date()) {
      console.log(`Using cached credentials for profile: ${profile}`);
      return cached.credentials;
    }

    console.log(`Fetching fresh credentials for profile: ${profile}`);
    const credentials = await this.awsCredentials.getCredentials(profile);
    
    // Cache the credentials
    this.credentialCache.set(cacheKey, {
      credentials,
      expiry: new Date(Date.now() + this.CACHE_DURATION)
    });

    return credentials;
  }

  clearCache(profile?: string) {
    if (profile) {
      this.credentialCache.delete(`credentials-${profile}`);
    } else {
      this.credentialCache.clear();
    }
  }

  getCacheStatus() {
    const status = Array.from(this.credentialCache.entries()).map(([key, value]) => ({
      profile: key.replace('credentials-', ''),
      hasCredentials: !!value.credentials,
      expiresAt: value.expiry,
      isExpired: value.expiry <= new Date()
    }));

    return status;
  }
}
```

### Cross-Account Access Service

```typescript
@Injectable()
export class CrossAccountService {
  constructor(private awsCredentials: AwsCredentials) {}

  async accessCrossAccountResource(
    targetAccountId: string,
    roleName: string,
    sourceProfile: string = 'production'
  ) {
    const sourceCredentials = await this.awsCredentials.getCredentials(sourceProfile);
    
    // Create STS client with source credentials
    const stsClient = new STSClient({
      region: sourceCredentials.region,
      credentials: sourceCredentials
    });

    // Assume role in target account
    const roleArn = `arn:aws:iam::${targetAccountId}:role/${roleName}`;
    const assumeRoleCommand = new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: `cross-account-${Date.now()}`,
      DurationSeconds: 3600 // 1 hour
    });

    const assumeRoleResponse = await stsClient.send(assumeRoleCommand);
    
    if (!assumeRoleResponse.Credentials) {
      throw new Error('Failed to assume cross-account role');
    }

    return {
      accessKeyId: assumeRoleResponse.Credentials.AccessKeyId!,
      secretAccessKey: assumeRoleResponse.Credentials.SecretAccessKey!,
      sessionToken: assumeRoleResponse.Credentials.SessionToken!,
      expiration: assumeRoleResponse.Credentials.Expiration
    };
  }

  async createCrossAccountClient<T>(
    clientClass: new (config: any) => T,
    targetAccountId: string,
    roleName: string,
    region: string,
    sourceProfile?: string
  ): Promise<T> {
    const crossAccountCredentials = await this.accessCrossAccountResource(
      targetAccountId,
      roleName,
      sourceProfile
    );

    return new clientClass({
      region,
      credentials: {
        accessKeyId: crossAccountCredentials.accessKeyId,
        secretAccessKey: crossAccountCredentials.secretAccessKey,
        sessionToken: crossAccountCredentials.sessionToken
      }
    });
  }
}
```

### Profile Validation Service

```typescript
@Injectable()
export class ProfileValidationService {
  constructor(private awsCredentials: AwsCredentials) {}

  async validateAllProfiles() {
    const config = this.awsCredentials.getConfiguration();
    const results = [];

    for (const [profileName, profileConfig] of Object.entries(config.profiles)) {
      try {
        console.log(`Validating profile: ${profileName}`);
        
        const credentials = await this.awsCredentials.getCredentials(profileName);
        
        // Test credentials by calling STS GetCallerIdentity
        const stsClient = new STSClient({
          region: profileConfig.region,
          credentials
        });

        const identity = await stsClient.send(new GetCallerIdentityCommand({}));
        
        results.push({
          profile: profileName,
          valid: true,
          account: identity.Account,
          arn: identity.Arn,
          userId: identity.UserId
        });

        console.log(`✅ Profile ${profileName} is valid (Account: ${identity.Account})`);
      } catch (error) {
        console.error(`❌ Profile ${profileName} validation failed:`, error.message);
        results.push({
          profile: profileName,
          valid: false,
          error: error.message
        });
      }
    }

    return results;
  }

  async validateProfile(profileName: string) {
    try {
      const credentials = await this.awsCredentials.getCredentials(profileName);
      const config = this.awsCredentials.getConfiguration();
      const profileConfig = config.profiles[profileName];

      if (!profileConfig) {
        throw new Error(`Profile ${profileName} not found in configuration`);
      }

      const stsClient = new STSClient({
        region: profileConfig.region,
        credentials
      });

      const identity = await stsClient.send(new GetCallerIdentityCommand({}));

      return {
        profile: profileName,
        valid: true,
        account: identity.Account,
        arn: identity.Arn,
        userId: identity.UserId,
        region: profileConfig.region
      };
    } catch (error) {
      return {
        profile: profileName,
        valid: false,
        error: error.message
      };
    }
  }
}
```

## Integration Examples

### Using with Other AWS Services

```typescript
@Injectable()
export class IntegratedAwsService {
  constructor(private awsCredentials: AwsCredentials) {}

  async createS3Service(profile?: string) {
    const credentials = await this.awsCredentials.getCredentials(profile);
    return new S3Service(new S3Client({
      region: credentials.region,
      credentials
    }));
  }

  async createDynamoDBService(profile?: string) {
    const credentials = await this.awsCredentials.getCredentials(profile);
    return new DynamoDBService(new DynamoDBClient({
      region: credentials.region,
      credentials
    }));
  }

  async createLambdaService(profile?: string) {
    const credentials = await this.awsCredentials.getCredentials(profile);
    return new LambdaService(new LambdaClient({
      region: credentials.region,
      credentials
    }));
  }
}
```

## Best Practices

### 1. Environment-Specific Profiles

```typescript
const getProfileForEnvironment = (env: string) => {
  switch (env) {
    case 'development':
    case 'dev':
      return 'development';
    case 'staging':
    case 'test':
      return 'staging';
    case 'production':
    case 'prod':
      return 'production';
    default:
      return 'development';
  }
};
```

### 2. Credential Rotation Handling

```typescript
@Injectable()
export class CredentialRotationService {
  constructor(private awsCredentials: AwsCredentials) {}

  async handleCredentialRotation(profile: string) {
    try {
      // Clear any cached credentials
      await this.awsCredentials.refreshCredentials(profile);
      
      // Verify new credentials work
      const validation = await this.validateCredentials(profile);
      
      if (!validation.valid) {
        throw new Error(`New credentials for ${profile} are invalid`);
      }

      console.log(`✅ Credentials rotated successfully for ${profile}`);
      return { success: true, profile, newIdentity: validation };
      
    } catch (error) {
      console.error(`❌ Credential rotation failed for ${profile}:`, error.message);
      throw error;
    }
  }

  private async validateCredentials(profile: string) {
    const credentials = await this.awsCredentials.getCredentials(profile);
    // Validation logic here
    return { valid: true };
  }
}
```

## Testing

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ServerAwsCredentialProvidersModule, AwsCredentials } from '@onivoro/server-aws-credential-providers';

describe('AwsCredentials', () => {
  let service: AwsCredentials;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ServerAwsCredentialProvidersModule.forRoot({
        profiles: {
          test: {
            region: 'us-east-1',
            accessKeyId: 'test-key',
            secretAccessKey: 'test-secret'
          }
        }
      })],
    }).compile();

    service = module.get<AwsCredentials>(AwsCredentials);
  });

  it('should resolve credentials for profile', async () => {
    const credentials = await service.getCredentials('test');
    expect(credentials).toBeDefined();
    expect(credentials.region).toBe('us-east-1');
  });
});
```

## API Reference

### Exported Classes
- `AwsCredentials`: Main credential management service
- `ServerAwsCredentialProvidersConfig`: Configuration class
- `ServerAwsCredentialProvidersModule`: NestJS module

### Exported Functions
- `resolveAwsCredentialProvidersByProfile`: Profile-specific credential resolution

## License

This library is licensed under the MIT License. See the LICENSE file in this package for details.