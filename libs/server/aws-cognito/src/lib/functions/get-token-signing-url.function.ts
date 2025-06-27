import { ServerAwsCognitoOidcConfig } from "../server-aws-cognito-oidc-config.class";

export function getTokenSigningUrl(_: Pick<ServerAwsCognitoOidcConfig, 'AWS_REGION' | 'COGNITO_DOMAIN_PREFIX'>) {
    return `https://${_.COGNITO_DOMAIN_PREFIX}.auth.${_.AWS_REGION}.amazoncognito.com/oauth2/token`;
}