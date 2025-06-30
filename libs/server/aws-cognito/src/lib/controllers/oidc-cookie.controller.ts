import { Body, Param, Post, Res } from "@nestjs/common";
import { DefaultApiController } from "@onivoro/server-common";
import { ApiBody, ApiParam } from "@nestjs/swagger";
import { ServerAwsCognitoOidcConfig } from "../server-aws-cognito-oidc-config.class";
import { TokensDto } from "../dtos/tokens.dto";
import { Response } from "express";
import { CookieService } from "../services/cookie.service";

@DefaultApiController('oidc-cookie')
export class OidcCookieController {

    @Post(':origin')
    @ApiParam({ type: 'string', name: 'origin' })
    @ApiBody({ type: TokensDto })
    post(@Param('origin') _origin: string, @Body() tokens: TokensDto, @Res() res: Response) {
        this.cookieService.setCookies(res, tokens);

        res.status(200).send({ message: 'Cookies set successfully' });
    }

    constructor(private config: ServerAwsCognitoOidcConfig, private cookieService: CookieService) { }
}