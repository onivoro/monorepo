import { Test } from '@nestjs/testing';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { JwksClient } from 'jwks-rsa';
import { ServerAwsCognitoModule } from './server-aws-cognito.module';
import { ServerAwsCognitoOidcModule } from './server-aws-cognito-oidc.module';
import { ServerAwsCognitoConfig } from './server-aws-cognito-config.class';
import { ServerAwsCognitoOidcConfig } from './server-aws-cognito-oidc-config.class';
import { CognitoTokenValidatorService } from './services/cognito-token-validator.service';
import { CognitoRefreshTokenService } from './services/cognito-refresh-token.service';
import { CognitoUserService } from './services/cognito-user.service';
import { CookieService } from './services/cookie.service';
import { UserHydraterService } from './services/user-hydrater.service';
import { OidcAuthMiddleware } from './middlewares/oidc-auth.middleware';
import { OidcIdTokenMiddleware } from './middlewares/oidc-id-token.middleware';
import { DefaultController } from './controllers/default.controller';
import { OidcConfigController } from './controllers/oidc-config.controller';
import { OidcCookieController } from './controllers/oidc-cookie.controller';

const config: ServerAwsCognitoOidcConfig = {
  AWS_REGION: 'us-east-1',
  COGNITO_USER_POOL_ID: 'us-east-1_pool',
  COGNITO_USER_POOL_CLIENT_ID: 'client-id',
  COGNITO_DOMAIN_PREFIX: 'prefix',
  COGNITO_API_VERSION: '2016-04-18',
};

describe(ServerAwsCognitoModule.name, () => {
  it('wires the config, Cognito client and services', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ServerAwsCognitoModule.configure(config)],
    }).compile();

    expect(moduleRef.get(ServerAwsCognitoConfig)).toBe(config);
    expect(moduleRef.get(CognitoTokenValidatorService)).toBeInstanceOf(
      CognitoTokenValidatorService,
    );
    expect(moduleRef.get(CognitoRefreshTokenService)).toBeInstanceOf(
      CognitoRefreshTokenService,
    );
    expect(moduleRef.get(CognitoUserService)).toBeInstanceOf(
      CognitoUserService,
    );
    const client = moduleRef.get(CognitoIdentityProviderClient);
    expect(client).toBeInstanceOf(CognitoIdentityProviderClient);
    expect(await client.config.region()).toBe('us-east-1');
  });
});

describe(ServerAwsCognitoOidcModule.name, () => {
  it('declares the OIDC controllers', () => {
    expect(ServerAwsCognitoOidcModule.configure(config).controllers).toEqual([
      DefaultController,
      OidcConfigController,
      OidcCookieController,
    ]);
  });

  it('wires the OIDC config, middlewares, services and JWKS client', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ServerAwsCognitoOidcModule.configure(config)],
    }).compile();

    expect(moduleRef.get(ServerAwsCognitoOidcConfig)).toBe(config);
    expect(moduleRef.get(CookieService)).toBeInstanceOf(CookieService);
    expect(moduleRef.get(UserHydraterService)).toBeInstanceOf(
      UserHydraterService,
    );
    expect(moduleRef.get(OidcAuthMiddleware)).toBeInstanceOf(
      OidcAuthMiddleware,
    );
    expect(moduleRef.get(OidcIdTokenMiddleware)).toBeInstanceOf(
      OidcIdTokenMiddleware,
    );
    expect(moduleRef.get(OidcConfigController).getEntra()).toEqual({
      value:
        'https://prefix.auth.us-east-1.amazoncognito.com/oauth2/idpresponse',
    });
    expect(moduleRef.get(JwksClient)).toBeInstanceOf(JwksClient);
  });
});
