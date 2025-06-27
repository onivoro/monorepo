import { Get, UseGuards } from "@nestjs/common";
import { HasTokenGuard } from "../guards/has-token.guard";
import { Token } from "../decorators/token.decorator";
import { IAccessToken } from "@onivoro/isomorphic/common";
import { DefaultApiController } from "@onivoro/server/common";

@UseGuards(HasTokenGuard)
@DefaultApiController('identity')
export class IdentityController {

    @Get('/')
    get(@Token() token: IAccessToken) {
        return token;
    }
}