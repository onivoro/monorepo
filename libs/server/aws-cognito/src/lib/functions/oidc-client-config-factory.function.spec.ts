import { oidcClientConfigFactory } from './oidc-client-config-factory.function';

describe(oidcClientConfigFactory.name, () => {
  it('builds an oidc-client config pointing at the Cognito hosted domain', () => {
    const authority = 'https://prefix.auth.us-east-1.amazoncognito.com';

    expect(
      oidcClientConfigFactory({
        AWS_REGION: 'us-east-1',
        COGNITO_USER_POOL_ID: 'us-east-1_pool',
        COGNITO_USER_POOL_CLIENT_ID: 'client-id',
        COGNITO_DOMAIN_PREFIX: 'prefix',
        redirectUri: 'https://app.example.com/post-login',
      }),
    ).toEqual({
      oidcUser: `oidc.user:${authority}:client-id`,
      authority,
      client_id: 'client-id',
      redirect_uri: 'https://app.example.com/post-login',
      response_type: 'code',
      scope: 'openid email',
      metadata: {
        issuer: authority,
        authorization_endpoint: `${authority}/oauth2/authorize`,
        token_endpoint: `${authority}/oauth2/token`,
        userinfo_endpoint: `${authority}/oauth2/userInfo`,
        jwks_uri: `${authority}/.well-known/jwks.json`,
        end_session_endpoint: `${authority}/logout`,
      },
    });
  });
});
