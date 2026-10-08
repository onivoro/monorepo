import { getOidcUser } from './get-oidc-user.function';
import { getTokenAuthority } from './get-token-authority.function';
import { getTokenIssuerUrl } from './get-token-issuer-url.function';
import { getTokenSigningKeyUrl } from './get-token-signing-key-url.function';
import { getTokenSigningUrl } from './get-token-signing-url.function';
import { oidcEntraConfigFactory } from './oidc-entra-config-factory.function';
import { formatIdentityTokenClaimObject } from './format-claim-overrides.function';

const config = {
  AWS_REGION: 'eu-west-2',
  COGNITO_USER_POOL_ID: 'eu-west-2_abc',
  COGNITO_USER_POOL_CLIENT_ID: 'client-id',
  COGNITO_DOMAIN_PREFIX: 'my-app',
};

describe('Cognito URL functions', () => {
  it('getTokenAuthority returns the hosted UI domain', () => {
    expect(getTokenAuthority(config)).toBe(
      'https://my-app.auth.eu-west-2.amazoncognito.com',
    );
  });

  it('getOidcUser returns the oidc-client storage key', () => {
    expect(getOidcUser(config)).toBe(
      'oidc.user:https://my-app.auth.eu-west-2.amazoncognito.com:client-id',
    );
  });

  it('getTokenIssuerUrl returns the user pool issuer', () => {
    expect(getTokenIssuerUrl(config)).toBe(
      'https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_abc',
    );
  });

  it('getTokenSigningKeyUrl returns the JWKS url of the user pool', () => {
    expect(getTokenSigningKeyUrl(config)).toBe(
      'https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_abc/.well-known/jwks.json',
    );
  });

  it('getTokenSigningUrl returns the token endpoint', () => {
    expect(getTokenSigningUrl(config)).toBe(
      'https://my-app.auth.eu-west-2.amazoncognito.com/oauth2/token',
    );
  });

  it('oidcEntraConfigFactory returns the idpresponse endpoint', () => {
    expect(oidcEntraConfigFactory(config)).toBe(
      'https://my-app.auth.eu-west-2.amazoncognito.com/oauth2/idpresponse',
    );
  });
});

describe(formatIdentityTokenClaimObject.name, () => {
  it('wraps the claims in a pre-token-generation response', () => {
    expect(formatIdentityTokenClaimObject({ role: 'admin' })).toEqual({
      response: {
        claimsAndScopeOverrideDetails: {
          idTokenGeneration: { claimsToAddOrOverride: { role: 'admin' } },
        },
      },
    });
  });
});
