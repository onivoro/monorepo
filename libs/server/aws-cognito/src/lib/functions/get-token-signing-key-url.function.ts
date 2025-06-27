import { ServerAwsCognitoOidcConfig } from "../server-aws-cognito-oidc-config.class";
import { getTokenIssuerUrl } from "./get-token-issuer-url.function";

export function getTokenSigningKeyUrl(_: Pick<ServerAwsCognitoOidcConfig, 'AWS_REGION' | 'COGNITO_USER_POOL_ID'>) {
    return `${getTokenIssuerUrl(_)}/.well-known/jwks.json`;
}