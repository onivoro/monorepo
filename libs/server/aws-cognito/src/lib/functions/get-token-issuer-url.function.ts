import { ServerAwsCognitoOidcConfig } from "../server-aws-cognito-oidc-config.class";

export function getTokenIssuerUrl(_: Pick<ServerAwsCognitoOidcConfig, 'AWS_REGION' | 'COGNITO_USER_POOL_ID'>) {
    return `https://cognito-idp.${_.AWS_REGION}.amazonaws.com/${_.COGNITO_USER_POOL_ID}`;
}