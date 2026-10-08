# @onivoro/server-aws-cognito

AWS Cognito integration for NestJS applications: ID/access token validation, OIDC (Cognito Hosted UI) cookie sessions, guards, decorators and helper DTOs.

## Installation

```bash
npm install @onivoro/server-aws-cognito
```

Peer dependencies: `@aws-sdk/client-cognito-identity-provider`, `@nestjs/common`, `@nestjs/swagger`, `jsonwebtoken`, `jwk-to-pem`, `jwks-rsa`, `axios`.

The OIDC middlewares and `CookieService` read cookies from `req.cookies`, so your app must also register [`cookie-parser`](https://www.npmjs.com/package/cookie-parser) (or an equivalent) for those features to work.

## Overview

- `ServerAwsCognitoModule`: token validation (`CognitoTokenValidatorService`), `GetUser` (`CognitoUserService`), and a refresh-token call (`CognitoRefreshTokenService`)
- `ServerAwsCognitoOidcModule`: everything above, plus cookie-based session handling (`CookieService`, `OidcAuthMiddleware`/`OidcIdTokenMiddleware`, `UserHydraterService`) and a few HTTP endpoints for an OIDC browser client
- Guards (`HasTokenGuard`, `HasIdTokenGuard`, `HasAccessTokenGuard`, abstract bases) and parameter decorators that read decoded tokens from the request
- Helper functions for Cognito URLs and OIDC client configuration, and DTOs/types for tokens, OIDC config, SAML config and pre-token-generation claim overrides

## Modules

### ServerAwsCognitoModule

```typescript
import { Module } from '@nestjs/common';
import { ServerAwsCognitoModule } from '@onivoro/server-aws-cognito';

@Module({
  imports: [
    ServerAwsCognitoModule.configure({
      AWS_REGION: 'us-east-1',
      COGNITO_USER_POOL_ID: 'us-east-1_XXXXXXXXX',
      COGNITO_USER_POOL_CLIENT_ID: 'your-app-client-id',
    }),
  ],
})
export class AppModule {}
```

Configuration:

```typescript
export class ServerAwsCognitoConfig {
  AWS_PROFILE?: string; // optional, see @onivoro/server-aws-credential-providers
  AWS_REGION: string;
  COGNITO_USER_POOL_ID: string;
  COGNITO_USER_POOL_CLIENT_ID: string; // expected `aud` (ID token) / `client_id` (access token)
  COGNITO_API_VERSION?: string | undefined; // passed as `apiVersion` to the SDK client
}
```

The module registers and exports `ServerAwsCognitoConfig`, `CognitoIdentityProviderClient` (built with [`awsClientProvider`](../aws-credential-providers/)), `CognitoTokenValidatorService`, `CognitoRefreshTokenService` and `CognitoUserService`. It also re-exports `ServerAwsCredentialProvidersModule`.

### ServerAwsCognitoOidcModule

```typescript
import { Module } from '@nestjs/common';
import { ServerAwsCognitoOidcModule } from '@onivoro/server-aws-cognito';

@Module({
  imports: [
    ServerAwsCognitoOidcModule.configure({
      AWS_REGION: 'us-east-1',
      COGNITO_USER_POOL_ID: 'us-east-1_XXXXXXXXX',
      COGNITO_USER_POOL_CLIENT_ID: 'your-app-client-id',
      COGNITO_DOMAIN_PREFIX: 'your-domain', // https://your-domain.auth.us-east-1.amazoncognito.com
    }),
  ],
})
export class AuthModule {}
```

Configuration:

```typescript
export class ServerAwsCognitoOidcConfig extends ServerAwsCognitoConfig {
  COGNITO_DOMAIN_PREFIX: string;
}
```

The module imports `ServerAwsCognitoModule.configure(config)` and registers and exports `CookieService`, `OidcAuthMiddleware`, `OidcIdTokenMiddleware`, `UserHydraterService`, a `JwksClient` (from `jwks-rsa`, for the user pool's JWKS in `AWS_REGION`), and `ServerAwsCognitoOidcConfig`.

It also mounts these controllers (paths are relative to any global prefix):

| Method & path                          | Behavior                                                                                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /`                               | Body `TokensDto`; sets the token cookies via `CookieService.setCookies` and responds `{ message: 'Cookies set successfully' }`                         |
| `POST /oidc-cookie/:origin`            | Same as above (`:origin` is ignored)                                                                                                                   |
| `GET /oidc-config/client/:redirectUri` | Returns `oidcClientConfigFactory(...)` (an `OidcClientConfigDto`) with `redirect_uri` set to `<request origin>/post-login` (`:redirectUri` is ignored) |
| `GET /oidc-config/entra`               | Returns `{ value: oidcEntraConfigFactory(config) }`, the Cognito `/oauth2/idpresponse` URL                                                             |

## Core Services

### CognitoTokenValidatorService

Verifies Cognito JWTs (RS256) against the user pool's JWKS (`https://cognito-idp.<AWS_REGION>.amazonaws.com/<COGNITO_USER_POOL_ID>/.well-known/jwks.json`). The JWKS is fetched in `onModuleInit` and cached for the life of the process.

`validate(token?: string, options?: { throwOnExpired?: boolean }): Promise<string | JwtPayload | undefined>`

- Strips a leading `Bearer `.
- Checks the issuer, and the `client_id` claim (access tokens) or `aud` (ID tokens) against `COGNITO_USER_POOL_CLIENT_ID`.
- Returns the decoded payload on success. By default it **never throws**: a missing, malformed, expired or invalid token returns `undefined` and the error is logged.
- With `{ throwOnExpired: true }`, an expired (but otherwise well-formed) token rethrows `jsonwebtoken`'s `TokenExpiredError` instead, so the caller can try a refresh. Every other failure still returns `undefined`.

The service also exposes an `issuer` getter (the user pool issuer URL).

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CognitoTokenValidatorService, ICognitoIdToken } from '@onivoro/server-aws-cognito';

@Injectable()
export class AuthService {
  constructor(private readonly tokenValidator: CognitoTokenValidatorService) {}

  async requireIdToken(token: string): Promise<ICognitoIdToken> {
    const decoded = await this.tokenValidator.validate(token);
    if (!decoded) {
      throw new UnauthorizedException();
    }
    return decoded as unknown as ICognitoIdToken;
  }
}
```

### CognitoRefreshTokenService

`getRefreshToken(refreshToken: string)` POSTs a `REFRESH_TOKEN_AUTH` `InitiateAuth` body (with `ClientId: COGNITO_USER_POOL_CLIENT_ID`) to `https://cognito-idp.<AWS_REGION>.amazonaws.com`. It resolves with the response's `AuthenticationResult`, or `undefined` if the request fails.

```typescript
import { Injectable } from '@nestjs/common';
import { CognitoRefreshTokenService } from '@onivoro/server-aws-cognito';

@Injectable()
export class TokenService {
  constructor(private readonly refreshTokenService: CognitoRefreshTokenService) {}

  refresh(refreshToken: string) {
    return this.refreshTokenService.getRefreshToken(refreshToken);
  }
}
```

The request is sent with `Content-Type: application/x-amz-json-1.1` and `X-Amz-Target: AWSCognitoIdentityProviderService.InitiateAuth`, as the Cognito JSON API requires. The body has no `SECRET_HASH`, so this works only for app clients without a client secret.

### CognitoUserService

`getUser(accessToken?: string)` strips `Bearer ` and sends `GetUserCommand` with the injected `CognitoIdentityProviderClient`. It returns the `GetUserCommandOutput` (`Username`, `UserAttributes`, ...) or `undefined` on any error. Errors are logged with `console.error`; successful responses are not logged.

```typescript
import { Injectable } from '@nestjs/common';
import { CognitoUserService } from '@onivoro/server-aws-cognito';

@Injectable()
export class UserService {
  constructor(private readonly cognitoUserService: CognitoUserService) {}

  async getEmail(accessToken: string) {
    const user = await this.cognitoUserService.getUser(accessToken);
    return user?.UserAttributes?.find((a) => a.Name === 'email')?.Value;
  }
}
```

### CookieService

Available from `ServerAwsCognitoOidcModule`, since it depends on `ServerAwsCognitoOidcConfig`.

- `setCookies(res: Response, tokens: TokensDto)`: sets one cookie each for `id_token`, `refresh_token` and `access_token` when present. Cookie options are as follows:
  - `httpOnly: true` and `path: '/api'`.
  - On localhost/127.0.0.1: `secure: false` and `sameSite: false`. Everywhere else: `secure: true`, `sameSite: 'strict'`, and `domain` set to the registrable domain of the request origin (for example `.example.com`; a few two-part TLDs such as `co.uk` are handled).
  - `maxAge` comes from the token's `exp` claim, when present.
- `getTokenFullName(name)`: the cookie name, `` `${COGNITO_DOMAIN_PREFIX}___${AWS_REGION}___${COGNITO_USER_POOL_CLIENT_ID}___${name}` ``.
- `get(req: Request, name: 'id_token' | 'refresh_token' | 'access_token')`: reads that cookie from `req.cookies`.

There is no method that clears cookies. To clear them, call `res.clearCookie(cookieService.getTokenFullName(name), { path: '/api', domain })` with the same `domain` the cookies were set with.

```typescript
import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { CookieService, TokensDto } from '@onivoro/server-aws-cognito';

@Controller('session')
export class SessionController {
  constructor(private readonly cookieService: CookieService) {}

  @Post()
  start(@Body() tokens: TokensDto, @Res({ passthrough: true }) res: Response) {
    this.cookieService.setCookies(res, tokens);
  }

  @Get('has-refresh-token')
  hasRefreshToken(@Req() req: Request) {
    return { value: !!this.cookieService.get(req, 'refresh_token') };
  }
}
```

### UserHydraterService

`hydrateUserByEmail(email?: string | null)` is a placeholder that resolves to `{ email }`. The OIDC middlewares store its result on `req.requestUser`, which `@RequestUser()` reads.

## Middleware

### OidcAuthMiddleware / OidcIdTokenMiddleware

The two classes have identical behavior. For any request whose `req.url` contains `/api/` (except exactly `/api/health`), the middleware does the following:

1. Reads the `id_token` cookie via `CookieService.get`, validates it with `CognitoTokenValidatorService`, and stores the decoded payload on `req.idToken` (or `undefined`).
2. If a token is present, sets `req.requestUser = await UserHydraterService.hydrateUserByEmail(idToken.email)`.
3. Always calls `next()`. It never rejects the request; use a guard for that.

If the `id_token` cookie has expired, the middleware validates it with `{ throwOnExpired: true }`, catches the `TokenExpiredError`, and refreshes with the `refresh_token` cookie: it POSTs `grant_type=refresh_token&client_id=<COGNITO_USER_POOL_CLIENT_ID>&refresh_token=<cookie>` (form-urlencoded) to the hosted-UI token endpoint `https://<COGNITO_DOMAIN_PREFIX>.auth.<AWS_REGION>.amazoncognito.com/oauth2/token`. If the response has a valid `id_token`, it is stored on `req.idToken` and the returned tokens are written back as cookies with `CookieService.setCookies`. If there is no refresh token, or the refresh fails, `req.idToken` stays `undefined`. Like `CognitoRefreshTokenService`, it sends no client secret.

Apply it in a module that imports `ServerAwsCognitoOidcModule`:

```typescript
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { OidcAuthMiddleware, ServerAwsCognitoOidcModule } from '@onivoro/server-aws-cognito';

@Module({
  imports: [ServerAwsCognitoOidcModule.configure(oidcConfig)],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(OidcAuthMiddleware).forRoutes('*');
  }
}
```

## Guards

| Guard                 | Request property  | Behavior                           |
| --------------------- | ----------------- | ---------------------------------- |
| `HasIdTokenGuard`     | `req.idToken`     | `UnauthorizedException` if missing |
| `HasTokenGuard`       | `req.idToken`     | Alias of `HasIdTokenGuard`         |
| `HasAccessTokenGuard` | `req.accessToken` | `UnauthorizedException` if missing |

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
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

The library never populates `req.accessToken` (`accessTokenKey`); the OIDC middleware only sets `req.idToken` and `req.requestUser`. If you use `HasAccessTokenGuard`, `@AccessToken()` or `@AccessTokenUsername()`, set `req.accessToken` yourself, for example from your own middleware that validates the `Authorization` header.

### AbstractIdTokenGuard / AbstractAccessTokenGuard

Base classes for custom guards. Implement `evaluateToken` as a property. When the token is missing, `canActivate` throws `UnauthorizedException`. When `evaluateToken` returns `false`, it throws `ForbiddenException`.

```typescript
import { Injectable } from '@nestjs/common';
import { AbstractIdTokenGuard, ICognitoIdentityToken } from '@onivoro/server-aws-cognito';

@Injectable()
export class AdminGuard extends AbstractIdTokenGuard {
  evaluateToken = (token?: ICognitoIdentityToken) => !!token?.['cognito:groups']?.includes('admin');
}
```

### authorizeRequestByIdToken / authorizeRequestByAccessToken

The functions behind those guards, for use in your own `canActivate`:

```typescript
authorizeRequestByIdToken(context: ExecutionContext, evaluator?: (token?, request?) => boolean, errorMessage?: string): boolean
authorizeRequestByAccessToken(context: ExecutionContext, evaluator?: (token?, request?) => boolean, errorMessage?: string): boolean
```

```typescript
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { authorizeRequestByIdToken } from '@onivoro/server-aws-cognito';

@Injectable()
export class VerifiedEmailGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    return authorizeRequestByIdToken(context, (token) => !!token?.email_verified, 'Email not verified');
  }
}
```

## Decorators

| Decorator                | Returns                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| `@RequestUser()`         | `req.requestUser` (set by the OIDC middleware)                                                           |
| `@IdToken()`             | `req.idToken`, the decoded ID token payload (`ICognitoIdentityToken`)                                    |
| `@IdTokenEmail()`        | `req.idToken?.email`                                                                                     |
| `@AccessToken()`         | `req.accessToken`, the decoded access token (`ICognitoAccessToken`)                                      |
| `@AccessTokenUsername()` | `req.accessToken.username ?? req.accessToken['cognito:username']` (throws if `req.accessToken` is unset) |
| `@AccessTokenHeader()`   | Raw `Authorization` header with `Bearer ` removed, or `''`                                               |

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AccessTokenHeader, HasTokenGuard, ICognitoIdentityToken, IdToken, IdTokenEmail, RequestUser } from '@onivoro/server-aws-cognito';

@Controller('user')
@UseGuards(HasTokenGuard)
export class UserController {
  @Get('profile')
  getProfile(@RequestUser() user: { email?: string }) {
    return user;
  }

  @Get('email')
  getEmail(@IdTokenEmail() email: string) {
    return { email };
  }

  @Get('token-info')
  getTokenInfo(@IdToken() idToken: ICognitoIdentityToken, @AccessTokenHeader() rawAccessToken: string) {
    return { sub: idToken.sub, groups: idToken['cognito:groups'], hasAccessToken: !!rawAccessToken };
  }
}
```

### Request keys

The request property names are exported as constants: `idTokenKey = 'idToken'`, `accessTokenKey = 'accessToken'`, `requestUserKey = 'requestUser'`, and `xIdTokenKey = 'x-id-token'` (exported, but not used by the library).

## Configuration Factories

```typescript
import { oidcClientConfigFactory, oidcEntraConfigFactory } from '@onivoro/server-aws-cognito';

// OIDC client settings for a browser library such as oidc-client-ts
const clientConfig = oidcClientConfigFactory({
  ...oidcConfig, // ServerAwsCognitoOidcConfig
  redirectUri: 'https://app.example.com/post-login',
});
// {
//   oidcUser: 'oidc.user:https://your-domain.auth.us-east-1.amazoncognito.com:<client id>',
//   authority: 'https://your-domain.auth.us-east-1.amazoncognito.com',
//   client_id, redirect_uri, response_type: 'code', scope: 'openid email',
//   metadata: { issuer, authorization_endpoint, token_endpoint, userinfo_endpoint, jwks_uri, end_session_endpoint }
// }

// Reply URL to register in Microsoft Entra ID when federating Entra into Cognito
const entraReplyUrl = oidcEntraConfigFactory({ COGNITO_DOMAIN_PREFIX: 'your-domain', AWS_REGION: 'us-east-1' });
// 'https://your-domain.auth.us-east-1.amazoncognito.com/oauth2/idpresponse'
```

## Helper Functions

The URL helpers take a config-shaped object, not positional arguments:

```typescript
import { extractOrigin, formatIdentityTokenClaimObject, getOidcUser, getTokenIssuerUrl, getTokenSigningKeyUrl, getTokenSigningUrl } from '@onivoro/server-aws-cognito';

const cfg = {
  AWS_REGION: 'us-east-1',
  COGNITO_USER_POOL_ID: 'us-east-1_XXXXXXXXX',
  COGNITO_USER_POOL_CLIENT_ID: 'abc123',
  COGNITO_DOMAIN_PREFIX: 'your-domain',
};

getTokenIssuerUrl(cfg); // 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_XXXXXXXXX'
getTokenSigningKeyUrl(cfg); // '<issuer>/.well-known/jwks.json'
getTokenSigningUrl(cfg); // 'https://your-domain.auth.us-east-1.amazoncognito.com/oauth2/token'
getOidcUser(cfg); // 'oidc.user:https://your-domain.auth.us-east-1.amazoncognito.com:abc123'

// Origin (scheme://host[:port]) of the current request, from the response's
// `origin` header, else the request's Origin, else Referer; pass a second argument to override
const origin = extractOrigin(res);

// Response object for a Cognito pre-token-generation Lambda trigger
const claimResponse = formatIdentityTokenClaimObject({ tenantId: 't-123' });
// { response: { claimsAndScopeOverrideDetails: { idTokenGeneration: { claimsToAddOrOverride: { tenantId: 't-123' } } } } }
```

## Types and DTOs

```typescript
import {
  // token payloads
  ICognitoIdentityToken, // decoded ID token (sub, email, email_verified, 'cognito:groups', 'cognito:username', identities, ...)
  ICognitoIdToken, // alias of ICognitoIdentityToken
  ICognitoAccessToken, // decoded access token (sub, client_id, scope, username, 'cognito:username', token_use: 'access', ...)
  CognitoJWK, // { alg, e, kid, kty, n, use }
  TCognitoAttribute, // { Name: string; Value: string }

  // DTOs (decorated for @nestjs/swagger)
  TokensDto, // { id_token, refresh_token, access_token, expires_in, token_type? }
  OidcClientConfigDto,
  OidcClientConfigMetadataDto,
  CognitoSamlClientConfigDto, // { authority, client_id, redirect_uri, response_type, scope }
  CognitoSamlIdpConfigDto, // { entityIdentifier, replyUrl, signOnUrl?, relayState, logoutUrl? }

  // pre-token-generation claim override shapes
  IClaimResponse,
  ClaimDto,
  ClaimResponseDto,
  ClaimsAndScopeOverrideDetailsDto,
  IdTokenGenerationDto,
} from '@onivoro/server-aws-cognito';
```

`TokensDto` uses the snake_case field names of the Cognito `/oauth2/token` response:

```typescript
export class TokensDto {
  id_token: string;
  refresh_token: string;
  access_token: string;
  expires_in: number;
  token_type?: string;
}
```

## Complete Example

```typescript
import { Controller, Get, MiddlewareConsumer, Module, NestModule, UseGuards } from '@nestjs/common';
import { CognitoUserService, HasTokenGuard, IdTokenEmail, OidcAuthMiddleware, RequestUser, ServerAwsCognitoOidcModule, AccessTokenHeader } from '@onivoro/server-aws-cognito';

@Controller('auth')
export class AuthController {
  constructor(private readonly userService: CognitoUserService) {}

  @Get('profile')
  @UseGuards(HasTokenGuard)
  getProfile(@RequestUser() user: { email?: string }, @IdTokenEmail() email: string) {
    return { user, email, timestamp: new Date() };
  }

  @Get('cognito-user')
  getCognitoUser(@AccessTokenHeader() accessToken: string) {
    return this.userService.getUser(accessToken);
  }
}

@Module({
  imports: [
    ServerAwsCognitoOidcModule.configure({
      AWS_REGION: process.env.AWS_REGION!,
      COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID!,
      COGNITO_USER_POOL_CLIENT_ID: process.env.COGNITO_USER_POOL_CLIENT_ID!,
      COGNITO_DOMAIN_PREFIX: process.env.COGNITO_DOMAIN_PREFIX!,
    }),
  ],
  controllers: [AuthController],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(OidcAuthMiddleware).forRoutes('*');
  }
}
```

The modules do not read environment variables themselves; pass values in through the config object as shown.

## Security Notes

1. `validate()` returns `undefined` rather than throwing (unless you pass `throwOnExpired: true`), so always check its result, or protect routes with a guard.
2. The token cookies are `httpOnly`, scoped to `path: '/api'`, and `secure` + `sameSite: 'strict'` on non-localhost origins. Serve your API under `/api` for the browser to send them.
3. Use HTTPS in production for all authentication flows.
4. The `JwksClient` provider registered by `ServerAwsCognitoOidcModule` points at `https://cognito-idp.<AWS_REGION>.amazonaws.com/<COGNITO_USER_POOL_ID>/.well-known/jwks.json`. Nothing in this package injects it (`CognitoTokenValidatorService` fetches the JWKS itself), but it is exported for your own use.

## License

MIT
