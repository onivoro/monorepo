import { ServerAwsCognitoOidcConfig } from "../server-aws-cognito-oidc-config.class";

export function oidcEntraConfigFactory(_: Pick<ServerAwsCognitoOidcConfig, 'COGNITO_DOMAIN_PREFIX' | 'AWS_REGION'>): string {
    return `https://${_.COGNITO_DOMAIN_PREFIX}.auth.${_.AWS_REGION}.amazoncognito.com/oauth2/idpresponse`;
}