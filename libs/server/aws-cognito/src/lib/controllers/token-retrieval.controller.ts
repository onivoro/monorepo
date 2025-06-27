import { BadRequestException, Body, Post } from "@nestjs/common";
import { DefaultApiController, ValueDto } from "@onivoro/server/common";
import { TokenRetrievalService } from "../services/token-retrieval.service";
import { ApiBody } from "@nestjs/swagger";

@DefaultApiController('token-retrieval')
export class TokenRetrievalController {

    @Post()
    @ApiBody({ type: ValueDto })
    async post(@Body() body: ValueDto) {
        if (!body.value) {
            throw new BadRequestException(`expected {value: 'code goes here'}`);
        }
        console.log({ body, detail: '/token-retrieval' });
        return this.tokenRetrievalService.exchangeCodeForTokens(body.value);
    }

    constructor(private tokenRetrievalService: TokenRetrievalService) { }
}