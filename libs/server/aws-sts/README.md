# @onivoro/server-aws-sts

A NestJS module for integrating with AWS STS (Security Token Service), providing temporary credential management, role assumption, identity verification, and cross-account access capabilities for your server applications.

## Installation

```bash
npm install @onivoro/server-aws-sts
```

## Features

- **Identity Verification**: Get caller identity and account information
- **Role Assumption**: Assume IAM roles for temporary access
- **Cross-Account Access**: Access resources across different AWS accounts
- **Temporary Credentials**: Generate and manage temporary AWS credentials
- **Session Management**: Create and manage temporary security sessions
- **Token Management**: Handle session tokens and their expiration
- **MFA Support**: Support for multi-factor authentication in role assumption
- **External ID Validation**: Secure cross-account access with external IDs

## Quick Start

### 1. Module Configuration

```typescript
import { ServerAwsStsModule } from '@onivoro/server-aws-sts';

@Module({
  imports: [
    ServerAwsStsModule.configure({
      AWS_REGION: 'us-east-1',
      AWS_PROFILE: process.env.AWS_PROFILE || 'default',
    }),
  ],
})
export class AppModule {}
```

### 2. Basic Usage

```typescript
import { StsService } from '@onivoro/server-aws-sts';

@Injectable()
export class IdentityService {
  constructor(private stsService: StsService) {}

  async getCurrentAccount() {
    const accountId = await this.stsService.getAccountId();
    return accountId;
  }

  async verifyIdentity() {
    const identity = await this.stsService.stsClient.send(new GetCallerIdentityCommand({}));
    return {
      account: identity.Account,
      arn: identity.Arn,
      userId: identity.UserId
    };
  }
}
```

## Configuration

### ServerAwsStsConfig

```typescript
import { ServerAwsStsConfig } from '@onivoro/server-aws-sts';

export class AppStsConfig extends ServerAwsStsConfig {
  AWS_REGION = process.env.AWS_REGION || 'us-east-1';
  AWS_PROFILE = process.env.AWS_PROFILE || 'default';
  DEFAULT_SESSION_DURATION = parseInt(process.env.STS_SESSION_DURATION) || 3600; // 1 hour
  MAX_SESSION_DURATION = parseInt(process.env.STS_MAX_SESSION_DURATION) || 43200; // 12 hours
  EXTERNAL_ID = process.env.STS_EXTERNAL_ID; // For cross-account access
}
```

### Environment Variables

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_PROFILE=default

# STS Configuration
STS_SESSION_DURATION=3600
STS_MAX_SESSION_DURATION=43200
STS_EXTERNAL_ID=unique-external-identifier
```

## Services

### StsService

The main service for STS operations:

```typescript
import { StsService } from '@onivoro/server-aws-sts';

@Injectable()
export class CredentialManagementService {
  constructor(private stsService: StsService) {}

  async getCurrentAccountInfo() {
    const accountId = await this.stsService.getAccountId();
    const identity = await this.stsService.stsClient.send(new GetCallerIdentityCommand({}));
    
    return {
      accountId,
      arn: identity.Arn,
      userId: identity.UserId,
      type: this.getIdentityType(identity.Arn!)
    };
  }

  private getIdentityType(arn: string): string {
    if (arn.includes(':user/')) return 'IAM User';
    if (arn.includes(':role/')) return 'IAM Role';
    if (arn.includes(':assumed-role/')) return 'Assumed Role';
    if (arn.includes(':federated-user/')) return 'Federated User';
    return 'Unknown';
  }
}
```

## Usage Examples

### Role Assumption Service

```typescript
import { StsService } from '@onivoro/server-aws-sts';
import { AssumeRoleCommand, AssumeRoleWithWebIdentityCommand } from '@aws-sdk/client-sts';

@Injectable()
export class RoleAssumptionService {
  constructor(private stsService: StsService) {}

  async assumeRole(roleArn: string, sessionName: string, durationSeconds?: number) {
    const command = new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: sessionName,
      DurationSeconds: durationSeconds || 3600
    });

    const response = await this.stsService.stsClient.send(command);
    
    if (!response.Credentials) {
      throw new Error('Failed to assume role');
    }

    return {
      accessKeyId: response.Credentials.AccessKeyId!,
      secretAccessKey: response.Credentials.SecretAccessKey!,
      sessionToken: response.Credentials.SessionToken!,
      expiration: response.Credentials.Expiration!,
      assumedRoleUser: response.AssumedRoleUser
    };
  }

  async assumeRoleWithExternalId(roleArn: string, sessionName: string, externalId: string, durationSeconds?: number) {
    const command = new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: sessionName,
      ExternalId: externalId,
      DurationSeconds: durationSeconds || 3600
    });

    return this.executeAssumeRole(command);
  }

  async assumeRoleWithMFA(roleArn: string, sessionName: string, mfaDeviceArn: string, mfaToken: string) {
    const command = new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: sessionName,
      SerialNumber: mfaDeviceArn,
      TokenCode: mfaToken,
      DurationSeconds: 3600
    });

    return this.executeAssumeRole(command);
  }

  async assumeRoleWithWebIdentity(roleArn: string, sessionName: string, webIdentityToken: string, providerId?: string) {
    const command = new AssumeRoleWithWebIdentityCommand({
      RoleArn: roleArn,
      RoleSessionName: sessionName,
      WebIdentityToken: webIdentityToken,
      ProviderId: providerId,
      DurationSeconds: 3600
    });

    const response = await this.stsService.stsClient.send(command);
    
    if (!response.Credentials) {
      throw new Error('Failed to assume role with web identity');
    }

    return {
      accessKeyId: response.Credentials.AccessKeyId!,
      secretAccessKey: response.Credentials.SecretAccessKey!,
      sessionToken: response.Credentials.SessionToken!,
      expiration: response.Credentials.Expiration!,
      assumedRoleUser: response.AssumedRoleUser,
      audience: response.Audience,
      provider: response.Provider
    };
  }

  private async executeAssumeRole(command: AssumeRoleCommand) {
    const response = await this.stsService.stsClient.send(command);
    
    if (!response.Credentials) {
      throw new Error('Failed to assume role');
    }

    return {
      accessKeyId: response.Credentials.AccessKeyId!,
      secretAccessKey: response.Credentials.SecretAccessKey!,
      sessionToken: response.Credentials.SessionToken!,
      expiration: response.Credentials.Expiration!,
      assumedRoleUser: response.AssumedRoleUser
    };
  }
}
```

### Cross-Account Access Service

```typescript
import { StsService } from '@onivoro/server-aws-sts';

@Injectable()
export class CrossAccountService {
  constructor(private stsService: StsService) {}

  async accessCrossAccountResource(
    targetAccountId: string,
    roleName: string,
    externalId?: string,
    sessionDuration: number = 3600
  ) {
    const roleArn = `arn:aws:iam::${targetAccountId}:role/${roleName}`;
    const sessionName = `cross-account-${Date.now()}`;

    const command = new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: sessionName,
      DurationSeconds: sessionDuration,
      ...(externalId && { ExternalId: externalId })
    });

    const response = await this.stsService.stsClient.send(command);
    
    if (!response.Credentials) {
      throw new Error(`Failed to assume role in account ${targetAccountId}`);
    }

    return {
      credentials: {
        accessKeyId: response.Credentials.AccessKeyId!,
        secretAccessKey: response.Credentials.SecretAccessKey!,
        sessionToken: response.Credentials.SessionToken!
      },
      expiration: response.Credentials.Expiration!,
      targetAccount: targetAccountId,
      assumedRole: roleArn
    };
  }

  async createCrossAccountClient<T>(
    clientClass: new (config: any) => T,
    targetAccountId: string,
    roleName: string,
    region: string,
    externalId?: string
  ): Promise<T> {
    const crossAccountAccess = await this.accessCrossAccountResource(
      targetAccountId,
      roleName,
      externalId
    );

    return new clientClass({
      region,
      credentials: crossAccountAccess.credentials
    });
  }

  async validateCrossAccountAccess(targetAccountId: string, roleName: string, externalId?: string): Promise<boolean> {
    try {
      const access = await this.accessCrossAccountResource(targetAccountId, roleName, externalId, 900); // 15 minutes
      
      // Test the credentials by calling GetCallerIdentity
      const testStsClient = new STSClient({
        credentials: access.credentials
      });
      
      const identity = await testStsClient.send(new GetCallerIdentityCommand({}));
      
      return identity.Account === targetAccountId;
    } catch (error) {
      console.error('Cross-account access validation failed:', error);
      return false;
    }
  }
}
```

### Session Management Service

```typescript
import { StsService } from '@onivoro/server-aws-sts';
import { GetSessionTokenCommand } from '@aws-sdk/client-sts';

@Injectable()
export class SessionManagementService {
  private activeSessions = new Map<string, SessionInfo>();

  constructor(private stsService: StsService) {}

  async createSession(sessionName: string, durationSeconds?: number, mfaDevice?: string, mfaToken?: string) {
    const command = new GetSessionTokenCommand({
      DurationSeconds: durationSeconds || 3600,
      ...(mfaDevice && mfaToken && {
        SerialNumber: mfaDevice,
        TokenCode: mfaToken
      })
    });

    const response = await this.stsService.stsClient.send(command);
    
    if (!response.Credentials) {
      throw new Error('Failed to create session token');
    }

    const sessionInfo: SessionInfo = {
      sessionName,
      credentials: {
        accessKeyId: response.Credentials.AccessKeyId!,
        secretAccessKey: response.Credentials.SecretAccessKey!,
        sessionToken: response.Credentials.SessionToken!
      },
      expiration: response.Credentials.Expiration!,
      createdAt: new Date(),
      mfaUsed: !!(mfaDevice && mfaToken)
    };

    this.activeSessions.set(sessionName, sessionInfo);
    
    return sessionInfo;
  }

  async refreshSession(sessionName: string, durationSeconds?: number) {
    const existingSession = this.activeSessions.get(sessionName);
    
    if (!existingSession) {
      throw new Error(`Session ${sessionName} not found`);
    }

    // Create new session with same parameters
    return this.createSession(sessionName, durationSeconds);
  }

  async getSession(sessionName: string): Promise<SessionInfo | undefined> {
    const session = this.activeSessions.get(sessionName);
    
    if (session && this.isSessionExpired(session)) {
      this.activeSessions.delete(sessionName);
      return undefined;
    }
    
    return session;
  }

  async revokeSession(sessionName: string) {
    this.activeSessions.delete(sessionName);
  }

  async getActiveSessions(): Promise<SessionInfo[]> {
    const activeSessions = [];
    
    for (const [name, session] of this.activeSessions.entries()) {
      if (this.isSessionExpired(session)) {
        this.activeSessions.delete(name);
      } else {
        activeSessions.push(session);
      }
    }
    
    return activeSessions;
  }

  private isSessionExpired(session: SessionInfo): boolean {
    return new Date() >= session.expiration;
  }

  async cleanupExpiredSessions() {
    const expired = [];
    
    for (const [name, session] of this.activeSessions.entries()) {
      if (this.isSessionExpired(session)) {
        expired.push(name);
        this.activeSessions.delete(name);
      }
    }
    
    console.log(`Cleaned up ${expired.length} expired sessions`);
    return expired;
  }
}
```

### Federated Identity Service

```typescript
import { StsService } from '@onivoro/server-aws-sts';
import { AssumeRoleWithSAMLCommand, AssumeRoleWithWebIdentityCommand } from '@aws-sdk/client-sts';

@Injectable()
export class FederatedIdentityService {
  constructor(private stsService: StsService) {}

  async assumeRoleWithSAML(
    roleArn: string,
    principalArn: string,
    samlAssertion: string,
    sessionName?: string
  ) {
    const command = new AssumeRoleWithSAMLCommand({
      RoleArn: roleArn,
      PrincipalArn: principalArn,
      SAMLAssertion: samlAssertion,
      DurationSeconds: 3600
    });

    const response = await this.stsService.stsClient.send(command);
    
    if (!response.Credentials) {
      throw new Error('Failed to assume role with SAML');
    }

    return {
      credentials: {
        accessKeyId: response.Credentials.AccessKeyId!,
        secretAccessKey: response.Credentials.SecretAccessKey!,
        sessionToken: response.Credentials.SessionToken!
      },
      expiration: response.Credentials.Expiration!,
      assumedRoleUser: response.AssumedRoleUser,
      audience: response.Audience,
      issuer: response.Issuer,
      subject: response.Subject,
      subjectType: response.SubjectType
    };
  }

  async assumeRoleWithOIDC(
    roleArn: string,
    webIdentityToken: string,
    providerId?: string,
    sessionName?: string
  ) {
    const command = new AssumeRoleWithWebIdentityCommand({
      RoleArn: roleArn,
      RoleSessionName: sessionName || `oidc-session-${Date.now()}`,
      WebIdentityToken: webIdentityToken,
      ProviderId: providerId,
      DurationSeconds: 3600
    });

    const response = await this.stsService.stsClient.send(command);
    
    if (!response.Credentials) {
      throw new Error('Failed to assume role with OIDC');
    }

    return {
      credentials: {
        accessKeyId: response.Credentials.AccessKeyId!,
        secretAccessKey: response.Credentials.SecretAccessKey!,
        sessionToken: response.Credentials.SessionToken!
      },
      expiration: response.Credentials.Expiration!,
      assumedRoleUser: response.AssumedRoleUser,
      audience: response.Audience,
      provider: response.Provider
    };
  }

  async createFederatedSession(identityProvider: IdentityProvider, token: string, roleArn: string) {
    switch (identityProvider.type) {
      case 'SAML':
        return this.assumeRoleWithSAML(
          roleArn,
          identityProvider.principalArn!,
          token
        );
      case 'OIDC':
        return this.assumeRoleWithOIDC(
          roleArn,
          token,
          identityProvider.providerId
        );
      default:
        throw new Error(`Unsupported identity provider type: ${identityProvider.type}`);
    }
  }
}
```

### Token Validation Service

```typescript
import { StsService } from '@onivoro/server-aws-sts';

@Injectable()
export class TokenValidationService {
  constructor(private stsService: StsService) {}

  async validateCredentials(credentials: AWSCredentials): Promise<ValidationResult> {
    try {
      const testStsClient = new STSClient({
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      });

      const identity = await testStsClient.send(new GetCallerIdentityCommand({}));
      
      return {
        valid: true,
        identity: {
          account: identity.Account!,
          arn: identity.Arn!,
          userId: identity.UserId!
        },
        expiresAt: credentials.expiration
      };
    } catch (error: any) {
      return {
        valid: false,
        error: error.message,
        errorCode: error.name
      };
    }
  }

  async checkTokenExpiration(expiration: Date, bufferMinutes: number = 5): Promise<ExpirationCheck> {
    const now = new Date();
    const bufferTime = new Date(expiration.getTime() - (bufferMinutes * 60 * 1000));
    
    return {
      isExpired: now >= expiration,
      isNearExpiration: now >= bufferTime,
      remainingMinutes: Math.max(0, Math.floor((expiration.getTime() - now.getTime()) / (60 * 1000))),
      expiration
    };
  }

  async getIdentityFromToken(credentials: AWSCredentials) {
    const validation = await this.validateCredentials(credentials);
    
    if (!validation.valid) {
      throw new Error(`Invalid credentials: ${validation.error}`);
    }
    
    return validation.identity;
  }

  async isTemporaryCredential(credentials: AWSCredentials): Promise<boolean> {
    // Temporary credentials always have a session token
    return !!credentials.sessionToken;
  }
}
```

## Advanced Usage

### Credential Rotation Service

```typescript
@Injectable()
export class CredentialRotationService {
  private rotationSchedules = new Map<string, NodeJS.Timeout>();

  constructor(
    private stsService: StsService,
    private sessionService: SessionManagementService
  ) {}

  async scheduleCredentialRotation(
    sessionName: string,
    rotationIntervalMinutes: number = 50,
    sessionDurationSeconds: number = 3600
  ) {
    // Clear existing rotation if any
    this.clearRotationSchedule(sessionName);

    const rotationInterval = rotationIntervalMinutes * 60 * 1000;
    
    const timer = setInterval(async () => {
      try {
        console.log(`Rotating credentials for session: ${sessionName}`);
        await this.sessionService.refreshSession(sessionName, sessionDurationSeconds);
        console.log(`Successfully rotated credentials for session: ${sessionName}`);
      } catch (error) {
        console.error(`Failed to rotate credentials for session ${sessionName}:`, error);
      }
    }, rotationInterval);

    this.rotationSchedules.set(sessionName, timer);
    
    console.log(`Scheduled credential rotation for ${sessionName} every ${rotationIntervalMinutes} minutes`);
  }

  clearRotationSchedule(sessionName: string) {
    const existingTimer = this.rotationSchedules.get(sessionName);
    if (existingTimer) {
      clearInterval(existingTimer);
      this.rotationSchedules.delete(sessionName);
    }
  }

  clearAllRotationSchedules() {
    for (const [sessionName, timer] of this.rotationSchedules.entries()) {
      clearInterval(timer);
    }
    this.rotationSchedules.clear();
  }

  onModuleDestroy() {
    this.clearAllRotationSchedules();
  }
}
```

### Multi-Account Manager

```typescript
@Injectable()
export class MultiAccountManagerService {
  constructor(
    private stsService: StsService,
    private crossAccountService: CrossAccountService
  ) {}

  async assumeRoleInMultipleAccounts(
    accounts: Array<{ accountId: string; roleName: string; externalId?: string }>,
    sessionDuration: number = 3600
  ) {
    const results = await Promise.allSettled(
      accounts.map(account => 
        this.crossAccountService.accessCrossAccountResource(
          account.accountId,
          account.roleName,
          account.externalId,
          sessionDuration
        )
      )
    );

    return accounts.map((account, index) => ({
      accountId: account.accountId,
      roleName: account.roleName,
      success: results[index].status === 'fulfilled',
      ...(results[index].status === 'fulfilled' 
        ? { credentials: (results[index] as PromiseFulfilledResult<any>).value }
        : { error: (results[index] as PromiseRejectedResult).reason.message }
      )
    }));
  }

  async getAccountInventory() {
    const currentAccount = await this.stsService.getAccountId();
    const identity = await this.stsService.stsClient.send(new GetCallerIdentityCommand({}));
    
    return {
      currentAccount,
      currentIdentity: {
        arn: identity.Arn!,
        userId: identity.UserId!,
        type: this.getIdentityType(identity.Arn!)
      },
      timestamp: new Date().toISOString()
    };
  }

  private getIdentityType(arn: string): string {
    if (arn.includes(':user/')) return 'IAM User';
    if (arn.includes(':role/')) return 'IAM Role';
    if (arn.includes(':assumed-role/')) return 'Assumed Role';
    return 'Unknown';
  }
}
```

## Types and Interfaces

```typescript
interface SessionInfo {
  sessionName: string;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
  };
  expiration: Date;
  createdAt: Date;
  mfaUsed: boolean;
}

interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  expiration?: Date;
}

interface ValidationResult {
  valid: boolean;
  identity?: {
    account: string;
    arn: string;
    userId: string;
  };
  error?: string;
  errorCode?: string;
  expiresAt?: Date;
}

interface ExpirationCheck {
  isExpired: boolean;
  isNearExpiration: boolean;
  remainingMinutes: number;
  expiration: Date;
}

interface IdentityProvider {
  type: 'SAML' | 'OIDC';
  providerId?: string;
  principalArn?: string;
}
```

## Best Practices

### 1. Session Duration Management

```typescript
// Use appropriate session durations
const shortSession = 900;  // 15 minutes for high-privilege operations
const normalSession = 3600; // 1 hour for regular operations
const longSession = 43200;  // 12 hours for batch jobs (max)
```

### 2. Error Handling

```typescript
async safeAssumeRole(roleArn: string, sessionName: string): Promise<any | null> {
  try {
    return await this.assumeRole(roleArn, sessionName);
  } catch (error: any) {
    if (error.name === 'AccessDenied') {
      console.error('Insufficient permissions to assume role');
    } else if (error.name === 'InvalidParameterValue') {
      console.error('Invalid role ARN or session name');
    }
    return null;
  }
}
```

### 3. Security Best Practices

```typescript
// Always use external IDs for cross-account access
// Rotate credentials regularly
// Use MFA when possible
// Monitor session usage
```

## Testing

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ServerAwsStsModule, StsService } from '@onivoro/server-aws-sts';

describe('StsService', () => {
  let service: StsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ServerAwsStsModule.configure({
        AWS_REGION: 'us-east-1',
        AWS_PROFILE: 'test'
      })],
    }).compile();

    service = module.get<StsService>(StsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get account ID', async () => {
    const accountId = await service.getAccountId();
    expect(accountId).toBeDefined();
    expect(typeof accountId).toBe('string');
  });
});
```

## API Reference

### Exported Classes
- `ServerAwsStsConfig`: Configuration class for STS settings
- `ServerAwsStsModule`: NestJS module for STS integration

### Exported Services
- `StsService`: Main STS service with identity verification and account management capabilities

## License

This library is licensed under the MIT License. See the LICENSE file in this package for details.