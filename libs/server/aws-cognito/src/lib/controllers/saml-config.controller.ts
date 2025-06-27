import { Get } from "@nestjs/common";
import { DefaultApiController } from "@onivoro/server/common";
import { ApiResponse } from "@nestjs/swagger";
import { CognitoSamlClientConfigDto } from "../dtos/cognito-saml-client-config.dto";
import { ServerAwsCognitoSamlConfig } from "../server-aws-cognito-saml-config.class";
import { CognitoSamlIdpConfigDto } from "../dtos/cognito-saml-idp-config.dto";

@DefaultApiController('saml-config')
export class SamlConfigController {

    @Get('client')
    @ApiResponse({ type: CognitoSamlClientConfigDto })
    getClient(): CognitoSamlClientConfigDto {
        return {
            authority: `https://cognito-idp.${this.config.AWS_REGION}.amazonaws.com/${this.config.COGNITO_USER_POOL_ID}`,
            client_id: this.config.COGNITO_USER_POOL_CLIENT_ID,
            redirect_uri: this.config.COGNITO_REDIRECT_URI,
            response_type: "code",
            scope: "email openid profile",
        };
    }

    @Get('idp')
    @ApiResponse({ type: CognitoSamlIdpConfigDto })
    getIdp(): CognitoSamlIdpConfigDto {
        return {
            entityIdentifier: `urn:amazon:cognito:sp:${this.config.COGNITO_USER_POOL_ID}`,
            replyUrl: `https://${this.config.COGNITO_DOMAIN_PREFIX}.auth.${this.config.AWS_REGION}.amazoncognito.com/saml2/idpresponse`,
            signOnUrl: undefined,
            relayState: `identity_provider=MicrosoftEntra&client_id=${this.config.COGNITO_USER_POOL_CLIENT_ID}&scope=openid+email+aws.cognito.signin.user.admin&response_type=code&redirect_uri=${this.config.COGNITO_REDIRECT_URI}`,
            logoutUrl: undefined,
        };
    }

    constructor(private config: ServerAwsCognitoSamlConfig) { }
}