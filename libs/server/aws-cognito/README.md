# @onivoro/server-aws-cognito

A comprehensive NestJS module for AWS Cognito integration, providing OIDC (OpenID Connect) and SAML authentication, token validation, user management, and seamless integration with AWS Cognito User Pools and Identity Pools.

## Installation

```bash
npm install @onivoro/server-aws-cognito
```

## Features

- **OIDC Authentication**: Full OpenID Connect support with AWS Cognito
- **SAML Integration**: SAML 2.0 authentication and configuration
- **Token Management**: JWT token validation, refresh, and management
- **User Management**: User creation, profile management, and attribute handling
- **Multi-Provider Support**: Support for multiple identity providers (Cognito, Entra ID)
- **Cookie Management**: Secure cookie handling for session management
- **Middleware Integration**: Authentication middleware for request processing
- **Abstract Guards**: Extensible authentication guards for custom authorization

## Quick Start

### 1. OIDC Module Configuration

```typescript
import { ServerAwsCognitoOidcModule } from '@onivoro/server-aws-cognito';

@Module({
  imports: [
    ServerAwsCognitoOidcModule.forRoot({
      region: 'us-east-1',
      userPoolId: process.env.COGNITO_USER_POOL_ID,
      clientId: process.env.COGNITO_CLIENT_ID,
      clientSecret: process.env.COGNITO_CLIENT_SECRET,
      redirectUri: process.env.COGNITO_REDIRECT_URI,
      issuer: process.env.COGNITO_ISSUER,
    }),
  ],
})
export class AppModule {}
```

### 2. SAML Module Configuration

```typescript
import { ServerAwsCognitoSamlModule } from '@onivoro/server-aws-cognito';

@Module({
  imports: [
    ServerAwsCognitoSamlModule.forRoot({
      region: 'us-east-1',
      userPoolId: process.env.COGNITO_USER_POOL_ID,
      identityProviderName: process.env.SAML_PROVIDER_NAME,
      metadataUrl: process.env.SAML_METADATA_URL,
    }),
  ],
})
export class AppModule {}
```

### 3. Basic Authentication

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { HasTokenGuard, RequestUser, IdToken } from '@onivoro/server-aws-cognito';

@Controller('protected')
@UseGuards(HasTokenGuard)
export class ProtectedController {
  @Get('profile')
  getProfile(
    @RequestUser() user: any,
    @IdToken() idToken: string
  ) {
    return { user, tokenPresent: !!idToken };
  }
}
```

## Configuration Classes

### ServerAwsCognitoOidcConfig

```typescript
import { ServerAwsCognitoOidcConfig } from '@onivoro/server-aws-cognito';

export class AppCognitoOidcConfig extends ServerAwsCognitoOidcConfig {
  region = process.env.AWS_REGION || 'us-east-1';
  userPoolId = process.env.COGNITO_USER_POOL_ID;
  clientId = process.env.COGNITO_CLIENT_ID;
  clientSecret = process.env.COGNITO_CLIENT_SECRET;
  redirectUri = process.env.COGNITO_REDIRECT_URI;
  issuer = process.env.COGNITO_ISSUER;
  scope = 'openid profile email';
  responseType = 'code';
}
```

### ServerAwsCognitoSamlConfig

```typescript
import { ServerAwsCognitoSamlConfig } from '@onivoro/server-aws-cognito';

export class AppCognitoSamlConfig extends ServerAwsCognitoSamlConfig {
  region = process.env.AWS_REGION || 'us-east-1';
  userPoolId = process.env.COGNITO_USER_POOL_ID;
  identityProviderName = process.env.SAML_PROVIDER_NAME;
  metadataUrl = process.env.SAML_METADATA_URL;
  attributeMapping = {
    email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
    given_name: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
    family_name: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
  };
}
```

## Services

### CognitoUserService

User management service for AWS Cognito operations:

```typescript
import { CognitoUserService } from '@onivoro/server-aws-cognito';

@Injectable()
export class UserManagementService {
  constructor(private cognitoUserService: CognitoUserService) {}

  async createUser(userData: {
    email: string;
    temporaryPassword: string;
    attributes?: Record<string, string>;
  }) {
    return this.cognitoUserService.adminCreateUser({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: userData.email,
      TemporaryPassword: userData.temporaryPassword,
      UserAttributes: Object.entries(userData.attributes || {}).map(([Name, Value]) => ({
        Name,
        Value
      })),
      MessageAction: 'SUPPRESS'
    });
  }

  async getUser(username: string) {
    return this.cognitoUserService.adminGetUser({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: username
    });
  }

  async updateUserAttributes(username: string, attributes: Record<string, string>) {
    return this.cognitoUserService.adminUpdateUserAttributes({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: username,
      UserAttributes: Object.entries(attributes).map(([Name, Value]) => ({
        Name,
        Value
      }))
    });
  }

  async deleteUser(username: string) {
    return this.cognitoUserService.adminDeleteUser({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: username
    });
  }
}
```

### CognitoTokenValidatorService

Token validation and management service:

```typescript
import { CognitoTokenValidatorService } from '@onivoro/server-aws-cognito';

@Injectable()
export class TokenService {
  constructor(private tokenValidator: CognitoTokenValidatorService) {}

  async validateAccessToken(token: string) {
    try {
      const decoded = await this.tokenValidator.verifyToken(token);
      return { valid: true, payload: decoded };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  async validateIdToken(idToken: string) {
    try {
      const decoded = await this.tokenValidator.verifyIdToken(idToken);
      return { valid: true, user: decoded };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  async getTokenClaims(token: string) {
    return this.tokenValidator.getTokenClaims(token);
  }
}
```

### CognitoRefreshTokenService

Refresh token management:

```typescript
import { CognitoRefreshTokenService } from '@onivoro/server-aws-cognito';

@Injectable()
export class RefreshTokenService {
  constructor(private refreshTokenService: CognitoRefreshTokenService) {}

  async refreshTokens(refreshToken: string, clientId: string) {
    return this.refreshTokenService.refreshTokens({
      RefreshToken: refreshToken,
      ClientId: clientId
    });
  }

  async revokeToken(token: string, clientId: string) {
    return this.refreshTokenService.revokeToken({
      Token: token,
      ClientId: clientId
    });
  }
}
```

### TokenRetrievalService

Service for retrieving tokens from various sources:

```typescript
import { TokenRetrievalService } from '@onivoro/server-aws-cognito';

@Injectable()
export class AuthTokenService {
  constructor(private tokenRetrievalService: TokenRetrievalService) {}

  async exchangeCodeForTokens(authorizationCode: string, redirectUri: string) {
    return this.tokenRetrievalService.exchangeCodeForTokens({
      code: authorizationCode,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    });
  }

  async getTokensFromRequest(request: any) {
    return this.tokenRetrievalService.extractTokensFromRequest(request);
  }
}
```

### UserHydraterService

Service for hydrating user data from tokens:

```typescript
import { UserHydraterService } from '@onivoro/server-aws-cognito';

@Injectable()
export class UserContextService {
  constructor(private userHydrater: UserHydraterService) {}

  async hydrateUserFromToken(token: string) {
    return this.userHydrater.hydrateUser(token);
  }

  async getUserProfile(userId: string) {
    return this.userHydrater.getUserProfile(userId);
  }
}
```

### CookieService

Secure cookie management for authentication:

```typescript
import { CookieService } from '@onivoro/server-aws-cognito';

@Injectable()
export class SessionService {
  constructor(private cookieService: CookieService) {}

  setAuthCookies(response: any, tokens: { accessToken: string; idToken: string; refreshToken: string }) {
    this.cookieService.setSecureCookie(response, 'access_token', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 3600000 // 1 hour
    });

    this.cookieService.setSecureCookie(response, 'id_token', tokens.idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 3600000
    });

    this.cookieService.setSecureCookie(response, 'refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 2592000000 // 30 days
    });
  }

  clearAuthCookies(response: any) {
    this.cookieService.clearCookie(response, 'access_token');
    this.cookieService.clearCookie(response, 'id_token');
    this.cookieService.clearCookie(response, 'refresh_token');
  }
}
```

## Controllers

The module includes several pre-built controllers:

### OidcConfigController

```typescript
@Controller('auth/oidc')
export class AuthController {
  @Get('config')
  getOidcConfig() {
    // Returns OIDC client configuration
  }

  @Get('login')
  initiateLogin() {
    // Initiates OIDC login flow
  }

  @Get('callback')
  handleCallback() {
    // Handles OIDC callback
  }
}
```

### TokenValidationController

```typescript
@Controller('auth/token')
export class TokenController {
  @Post('validate')
  validateToken() {
    // Token validation endpoint
  }

  @Post('refresh')
  refreshToken() {
    // Token refresh endpoint
  }
}
```

## Data Transfer Objects (DTOs)

### OidcClientConfigDto

```typescript
export class OidcClientConfigDto {
  client_id: string;
  redirect_uris: string[];
  response_types: string[];
  grant_types: string[];
  scope: string;
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
}
```

### CognitoSamlClientConfigDto

```typescript
export class CognitoSamlClientConfigDto {
  providerName: string;
  metadataUrl: string;
  attributeMapping: Record<string, string>;
  signRequest: boolean;
  signAssertion: boolean;
}
```

### ClaimResponseDto

```typescript
export class ClaimResponseDto {
  sub: string;
  email: string;
  email_verified: boolean;
  given_name?: string;
  family_name?: string;
  picture?: string;
  custom_attributes?: Record<string, any>;
}
```

## Decorators

### Request Context Decorators

| Decorator | Description |
|-----------|-------------|
| `@RequestUser()` | Extract user object from request |
| `@IdToken()` | Extract ID token from request |
| `@AccessTokenHeader()` | Extract access token from Authorization header |
| `@Email()` | Extract email from token claims |

```typescript
@Controller('user')
export class UserController {
  @Get('profile')
  @UseGuards(HasTokenGuard)
  getProfile(
    @RequestUser() user: any,
    @Email() email: string,
    @IdToken() idToken: string
  ) {
    return { user, email, hasIdToken: !!idToken };
  }
}
```

## Utility Functions

### OIDC Configuration Factory

```typescript
import { oidcClientConfigFactory, oidcEntraConfigFactory } from '@onivoro/server-aws-cognito';

// AWS Cognito OIDC config
const cognitoConfig = oidcClientConfigFactory({
  region: 'us-east-1',
  userPoolId: 'us-east-1_ABC123',
  clientId: 'your-client-id'
});

// Microsoft Entra ID config
const entraConfig = oidcEntraConfigFactory({
  tenantId: 'your-tenant-id',
  clientId: 'your-client-id'
});
```

### Token Utilities

```typescript
import { 
  getTokenIssuerUrl, 
  getTokenSigningKeyUrl, 
  formatClaimOverrides,
  getOidcUser 
} from '@onivoro/server-aws-cognito';

// Get token issuer URL
const issuerUrl = getTokenIssuerUrl('us-east-1', 'us-east-1_ABC123');

// Get JWKS URL
const jwksUrl = getTokenSigningKeyUrl('us-east-1', 'us-east-1_ABC123');

// Format claim overrides
const claims = formatClaimOverrides({
  email: 'user@example.com',
  name: 'John Doe'
});

// Extract user from OIDC token
const user = getOidcUser(decodedToken);
```

## Middleware

### OidcAuthMiddleware

```typescript
import { OidcAuthMiddleware } from '@onivoro/server-aws-cognito';

@Module({
  imports: [ServerAwsCognitoOidcModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(OidcAuthMiddleware)
      .forRoutes({ path: 'protected/*', method: RequestMethod.ALL });
  }
}
```

## Advanced Usage

### Custom Auth Guard

```typescript
import { AbstractAuthGuard } from '@onivoro/server-aws-cognito';

@Injectable()
export class CustomCognitoGuard extends AbstractAuthGuard<any> {
  evaluateToken(token: any, request: any): boolean {
    // Custom token evaluation logic
    return token && token.token_use === 'access' && token.client_id === process.env.COGNITO_CLIENT_ID;
  }
}
```

### Multi-Provider Configuration

```typescript
@Module({
  imports: [
    ServerAwsCognitoOidcModule.forRoot({
      // Cognito configuration
      region: 'us-east-1',
      userPoolId: process.env.COGNITO_USER_POOL_ID,
      clientId: process.env.COGNITO_CLIENT_ID,
    }),
    ServerAwsCognitoSamlModule.forRoot({
      // SAML configuration
      region: 'us-east-1',
      userPoolId: process.env.COGNITO_USER_POOL_ID,
      identityProviderName: 'EntraID',
    })
  ],
})
export class MultiProviderModule {}
```

## Environment Variables

```bash
# AWS Configuration
AWS_REGION=us-east-1

# Cognito OIDC
COGNITO_USER_POOL_ID=us-east-1_ABC123
COGNITO_CLIENT_ID=your-client-id
COGNITO_CLIENT_SECRET=your-client-secret
COGNITO_REDIRECT_URI=https://yourapp.com/auth/callback
COGNITO_ISSUER=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABC123

# SAML
SAML_PROVIDER_NAME=EntraID
SAML_METADATA_URL=https://login.microsoftonline.com/tenant-id/federationmetadata/2007-06/federationmetadata.xml
```

## Testing

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ServerAwsCognitoOidcModule, CognitoTokenValidatorService } from '@onivoro/server-aws-cognito';

describe('CognitoTokenValidatorService', () => {
  let service: CognitoTokenValidatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ServerAwsCognitoOidcModule.forRoot({
        region: 'us-east-1',
        userPoolId: 'test-pool',
        clientId: 'test-client'
      })],
    }).compile();

    service = module.get<CognitoTokenValidatorService>(CognitoTokenValidatorService);
  });

  it('should validate tokens', () => {
    expect(service).toBeDefined();
  });
});
```

## API Reference

### Exported Modules
- `ServerAwsCognitoModule`: Main Cognito module
- `ServerAwsCognitoOidcModule`: OIDC-specific module
- `ServerAwsCognitoSamlModule`: SAML-specific module

### Exported Services
- `CognitoUserService`: User management
- `CognitoTokenValidatorService`: Token validation
- `CognitoRefreshTokenService`: Token refresh
- `TokenRetrievalService`: Token extraction
- `TokenValidationService`: Token verification
- `UserHydraterService`: User data hydration
- `CookieService`: Cookie management

### Exported Controllers
- `OidcConfigController`: OIDC configuration endpoints
- `OidcCookieController`: Cookie management endpoints
- `SamlConfigController`: SAML configuration endpoints
- `TokenRetrievalController`: Token retrieval endpoints
- `TokenValidationController`: Token validation endpoints

## License

This package is part of the Onivoro monorepo and follows the same licensing terms.