import { Response } from "express";
import { Get, Param, Res } from "@nestjs/common";
import { DefaultApiController, ValueDto } from "@onivoro/server-common";
import { ApiResponse } from "@nestjs/swagger";
import { ServerAwsCognitoOidcConfig } from "../server-aws-cognito-oidc-config.class";
import { OidcClientConfigDto } from "../dtos/oidc-client-config.dto";
import { oidcClientConfigFactory } from "../functions/oidc-client-config-factory.function";
import { oidcEntraConfigFactory } from "../functions/oidc-entra-config-factory.function";
import { extractOrigin } from "../functions/extract-origin.function";

@DefaultApiController('oidc-config')
export class OidcConfigController {

    @Get('client/:redirectUri')
    @ApiResponse({ type: OidcClientConfigDto })
    getClient(@Param('redirectUri') _redirectUri: string, @Res() res: Response) {
        return res.status(200).send(oidcClientConfigFactory({
            ...this.config,
            redirectUri: extractOrigin(res) + '/post-login',
        }));
    }

    @Get('entra')
    @ApiResponse({ type: ValueDto })
    getEntra(): ValueDto {
        return {
            value: oidcEntraConfigFactory(this.config)
        };
    }

    constructor(private config: ServerAwsCognitoOidcConfig) { }
}