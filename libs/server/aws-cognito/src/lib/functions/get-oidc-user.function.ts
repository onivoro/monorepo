import { ServerAwsCognitoOidcConfig } from "../server-aws-cognito-oidc-config.class";
import { getTokenAuthority } from "./get-token-authority.function";

export function getOidcUser(_: Pick<ServerAwsCognitoOidcConfig, 'COGNITO_DOMAIN_PREFIX' | 'AWS_REGION' | 'COGNITO_USER_POOL_CLIENT_ID'>) {
    return `oidc.user:${getTokenAuthority(_)}:${_.COGNITO_USER_POOL_CLIENT_ID}`;
}