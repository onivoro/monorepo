import { OidcClientConfigDto } from "../dtos/oidc-client-config.dto";
import { ServerAwsCognitoOidcConfig } from "../server-aws-cognito-oidc-config.class";
import { getOidcUser } from "./get-oidc-user.function";
import { getTokenAuthority } from "./get-token-authority.function";

export function oidcClientConfigFactory(_: ServerAwsCognitoOidcConfig & { redirectUri: string}): OidcClientConfigDto {
    const authority = getTokenAuthority(_);
    const oidcUser = getOidcUser(_);

    return {
        oidcUser,
        authority,
        client_id: _.COGNITO_USER_POOL_CLIENT_ID,
        redirect_uri: _.redirectUri,
        response_type: 'code',
        scope: 'openid email',
        metadata: {
            issuer: authority,
            authorization_endpoint: `${authority}/oauth2/authorize`,
            token_endpoint: `${authority}/oauth2/token`,
            userinfo_endpoint: `${authority}/oauth2/userInfo`,
            jwks_uri: `${authority}/.well-known/jwks.json`,
            end_session_endpoint: `${authority}/logout`,
        }
    };
}