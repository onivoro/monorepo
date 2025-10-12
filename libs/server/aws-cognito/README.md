# @onivoro/server-aws-cognito

AWS Cognito integration for NestJS applications with OIDC/SAML authentication and token validation.

## Installation

```bash
npm install @onivoro/server-aws-cognito
```

## Overview

This library provides comprehensive AWS Cognito integration for NestJS applications, supporting:
- OIDC (OpenID Connect) authentication
- SAML authentication configuration
- JWT token validation and refresh
- User management and attribute hydration
- Cookie-based session management
- Authentication guards and middlewares

## Modules

### 1. ServerAwsCognitoModule

Base module for AWS Cognito integration.

```typescript
import { ServerAwsCognitoModule } from '@onivoro/server-aws-cognito';

@Module({
  imports: [
    ServerAwsCognitoModule.configure()
  ]
})
export class AppModule {}
```

Configuration:
```typescript
export class ServerAwsCognitoConfig {
  AWS_COGNITO_USER_POOL_ID?: string;
  AWS_REGION: string;
  AWS_PROFILE?: string;
}
```

### 2. ServerAwsCognitoOidcModule

Module for OIDC authentication flow.

```typescript
import { ServerAwsCognitoOidcModule } from '@onivoro/server-aws-cognito';

@Module({
  imports: [
    ServerAwsCognitoOidcModule.configure()
  ]
})
export class AppModule {}
```

Configuration:
```typescript
export class ServerAwsCognitoOidcConfig {
  COGNITO_CLIENT_ID: string;
  COGNITO_DOMAIN_PREFIX: string;
  COGNITO_OIDC_LOGOUT_URL?: string;
  COGNITO_OIDC_REDIRECT_URL?: string;
  SERVER_URL: string;
}
```

## Core Services

### CognitoTokenValidatorService

Validates JWT tokens from AWS Cognito.

```typescript
import { CognitoTokenValidatorService } from '@onivoro/server-aws-cognito';

@Injectable()
export class AuthService {
  constructor(
    private readonly tokenValidator: CognitoTokenValidatorService
  ) {}

  async validateToken(token: string) {
    try {
      const decoded = await this.tokenValidator.validate(token);
      return { valid: true, claims: decoded };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}
```

### CognitoRefreshTokenService

Handles token refresh operations.

```typescript
import { CognitoRefreshTokenService } from '@onivoro/server-aws-cognito';

@Injectable()
export class TokenService {
  constructor(
    private readonly refreshTokenService: CognitoRefreshTokenService
  ) {}

  async refreshAccessToken(refreshToken: string) {
    const result = await this.refreshTokenService.refreshToken(refreshToken);
    return result;
  }
}
```

### CognitoUserService

Manages Cognito user operations.

```typescript
import { CognitoUserService } from '@onivoro/server-aws-cognito';

@Injectable()
export class UserService {
  constructor(
    private readonly cognitoUserService: CognitoUserService
  ) {}

  async getUser(accessToken: string) {
    const user = await this.cognitoUserService.getUser(accessToken);
    return user;
  }

  async getUserAttributes(accessToken: string) {
    const attributes = await this.cognitoUserService.getUserAttributes(accessToken);
    return attributes;
  }
}
```

### CookieService

Manages authentication cookies.

```typescript
import { CookieService } from '@onivoro/server-aws-cognito';

@Injectable()
export class SessionService {
  constructor(
    private readonly cookieService: CookieService
  ) {}

  setAuthCookies(response: Response, tokens: Tokens) {
    this.cookieService.setCookies(response, tokens);
  }

  clearAuthCookies(response: Response) {
    this.cookieService.clearCookies(response);
  }
}
```

### UserHydraterService

Hydrates user data from various sources.

```typescript
import { UserHydraterService } from '@onivoro/server-aws-cognito';

@Injectable()
export class ProfileService {
  constructor(
    private readonly userHydrater: UserHydraterService
  ) {}

  async hydrateUserProfile(userId: string, claims: any) {
    const hydratedUser = await this.userHydrater.hydrate(userId, claims);
    return hydratedUser;
  }
}
```

## Guards and Middleware

### HasTokenGuard

Guards routes requiring authentication.

```typescript
import { HasTokenGuard } from '@onivoro/server-aws-cognito';

@Controller('protected')
@UseGuards(HasTokenGuard)
export class ProtectedController {
  @Get()
  getProtectedResource() {
    return { message: 'This is protected' };
  }
}
```

### OidcAuthMiddleware

Middleware for OIDC authentication flow.

```typescript
import { OidcAuthMiddleware } from '@onivoro/server-aws-cognito';

export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(OidcAuthMiddleware)
      .forRoutes('/api/*');
  }
}
```

### AbstractAuthGuard

Base class for creating custom auth guards.

```typescript
import { AbstractAuthGuard } from '@onivoro/server-aws-cognito';

@Injectable()
export class CustomAuthGuard extends AbstractAuthGuard {
  protected async authorizeRequest(request: any): Promise<boolean> {
    // Custom authorization logic
    return true;
  }
}
```

## Decorators

### Request User Decorators

Extract user information from authenticated requests.

```typescript
import { 
  RequestUser, 
  Email, 
  IdToken,
  AccessTokenHeader 
} from '@onivoro/server-aws-cognito';

@Controller('user')
export class UserController {
  @Get('profile')
  getProfile(@RequestUser() user: any) {
    return user;
  }

  @Get('email')
  getEmail(@Email() email: string) {
    return { email };
  }

  @Get('token-info')
  getTokenInfo(
    @IdToken() idToken: string,
    @AccessTokenHeader() accessToken: string
  ) {
    return { idToken, accessToken };
  }
}
```

## Configuration Factories

### OIDC Client Configuration

```typescript
import { oidcClientConfigFactory, oidcEntraConfigFactory } from '@onivoro/server-aws-cognito';

// AWS Cognito OIDC config
const cognitoConfig = oidcClientConfigFactory({
  clientId: 'your-client-id',
  domainPrefix: 'your-domain',
  region: 'us-east-1',
  redirectUri: 'https://app.example.com/callback'
});

// Microsoft Entra (Azure AD) OIDC config
const entraConfig = oidcEntraConfigFactory({
  tenantId: 'your-tenant-id',
  clientId: 'your-client-id',
  redirectUri: 'https://app.example.com/callback'
});
```

## Helper Functions

### Token and Authorization Utilities

```typescript
import {
  authorizeRequest,
  extractOrigin,
  formatClaimOverrides,
  getOidcUser,
  getTokenIssuerUrl,
  getTokenSigningKeyUrl,
  getTokenSigningUrl
} from '@onivoro/server-aws-cognito';

// Authorize a request with custom logic
const isAuthorized = await authorizeRequest(request, authFunction);

// Extract origin from request
const origin = extractOrigin(request);

// Format claim overrides for SAML/OIDC
const formattedClaims = formatClaimOverrides(claims);

// Get OIDC user information
const user = await getOidcUser(accessToken, userInfoEndpoint);

// Get token URLs
const issuerUrl = getTokenIssuerUrl(region, userPoolId);
const signingKeyUrl = getTokenSigningKeyUrl(region, userPoolId);
const signingUrl = getTokenSigningUrl(region, userPoolId);
```

## Types and DTOs

### Core Types

```typescript
import {
  CognitoIdentityToken,
  CognitoJwk,
  CognitoAttribute,
  Tokens,
  ClaimResponse,
  OidcClientConfig,
  OidcClientConfigMetadata,
  CognitoSamlClientConfig,
  CognitoSamlIdpConfig
} from '@onivoro/server-aws-cognito';

// Token interface
interface Tokens {
  AccessToken: string;
  IdToken: string;
  RefreshToken?: string;
  TokenType?: string;
  ExpiresIn?: number;
}

// Identity token structure
interface CognitoIdentityToken {
  sub: string;
  email?: string;
  email_verified?: boolean;
  cognito:username?: string;
  // ... other claims
}
```

## Complete Example

```typescript
import { Module, Controller, Get, UseGuards } from '@nestjs/common';
import {
  ServerAwsCognitoModule,
  ServerAwsCognitoOidcModule,
  HasTokenGuard,
  RequestUser,
  Email,
  CognitoTokenValidatorService,
  CognitoUserService
} from '@onivoro/server-aws-cognito';

@Module({
  imports: [
    ServerAwsCognitoModule.configure(),
    ServerAwsCognitoOidcModule.configure()
  ]
})
export class AuthModule {}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly tokenValidator: CognitoTokenValidatorService,
    private readonly userService: CognitoUserService
  ) {}

  @Get('profile')
  @UseGuards(HasTokenGuard)
  async getProfile(
    @RequestUser() user: any,
    @Email() email: string
  ) {
    return {
      user,
      email,
      timestamp: new Date()
    };
  }

  @Post('validate')
  async validateToken(@Body('token') token: string) {
    try {
      const decoded = await this.tokenValidator.validate(token);
      return { valid: true, decoded };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}
```

## Environment Variables

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_PROFILE=default # Optional

# Cognito Configuration  
AWS_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX

# OIDC Configuration
COGNITO_CLIENT_ID=your-client-id
COGNITO_DOMAIN_PREFIX=your-domain
COGNITO_OIDC_LOGOUT_URL=https://app.example.com/logout
COGNITO_OIDC_REDIRECT_URL=https://app.example.com/callback
SERVER_URL=https://app.example.com
```

## Security Best Practices

1. **Token Validation**: Always validate tokens before trusting claims
2. **HTTPS Only**: Use HTTPS in production for all authentication flows
3. **Secure Cookies**: Cookie service sets httpOnly and secure flags
4. **CORS Configuration**: Configure CORS appropriately for your domain
5. **Token Refresh**: Implement token refresh to maintain sessions
6. **Guard Usage**: Use guards to protect sensitive endpoints

## License

MIT