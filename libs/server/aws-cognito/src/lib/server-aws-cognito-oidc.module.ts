import { Module } from '@nestjs/common';
import { moduleFactory } from '@onivoro/server/common';
import { JwksClient } from 'jwks-rsa';
import { ServerAwsCognitoOidcConfig } from './server-aws-cognito-oidc-config.class';
import { OidcConfigController } from './controllers/oidc-config.controller';
import { OidcCookieController } from './controllers/oidc-cookie.controller';
import { TokenValidationController } from './controllers/token-validation.controller';
import { TokenValidationService } from './services/token-validation.service';
import { OidcAuthMiddleware } from './middlewares/oidc-auth.middleware';
import { ServerAwsCognitoModule } from './server-aws-cognito.module';
import { UserHydraterService } from './services/user-hydrater.service';
import { CookieService } from './services/cookie.service';

@Module({})
export class ServerAwsCognitoOidcModule {
  static configure(config: ServerAwsCognitoOidcConfig) {
    return moduleFactory({
      module: ServerAwsCognitoOidcModule,
      imports: [
        ServerAwsCognitoModule.configure(config),
      ],
      providers: [
        CookieService,
        OidcAuthMiddleware,
        TokenValidationService,
        UserHydraterService,
        {
          provide: JwksClient,
          useValue: new JwksClient({
            jwksUri: `https://cognito-idp.us-east-2.amazonaws.com/${config.COGNITO_USER_POOL_ID}/.well-known/jwks.json`,
            cache: true, // Cache keys to reduce requests
            rateLimit: true, // Limit requests to JWKS endpoint
            jwksRequestsPerMinute: 10
          })
        },
        { provide: ServerAwsCognitoOidcConfig, useValue: config }
      ],
      controllers: [
        OidcConfigController,
        OidcCookieController,
        TokenValidationController,
      ],
    })
  }
}
