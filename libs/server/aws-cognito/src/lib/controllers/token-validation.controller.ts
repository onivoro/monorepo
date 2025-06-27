import { BadRequestException, Body, Post } from "@nestjs/common";
import { DefaultApiController, ValueDto } from "@onivoro/server/common";
import { ApiBody } from "@nestjs/swagger";
import { TokenValidationService } from "../services/token-validation.service";

@DefaultApiController('token-validation')
export class TokenValidationController {

    @Post()
    @ApiBody({ type: ValueDto })
    async post(@Body() body: ValueDto) {
        if (!body.value) {
            throw new BadRequestException(`expected {value: 'token goes here'}`);
        }
        return this.tokenValidationService.validateIdentityToken(body.value)
    }

    constructor(private tokenValidationService: TokenValidationService) { }
}