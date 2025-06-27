import { ServerAwsCognitoConfig } from "./server-aws-cognito-config.class";

export class ServerAwsCognitoSamlConfig extends ServerAwsCognitoConfig {
    COGNITO_DOMAIN_PREFIX: string;
    COGNITO_REDIRECT_URI: string;
    COGNITO_TOKEN_ENDPOINT: string;
}
