import { ExecutionContext, createParamDecorator } from "@nestjs/common";
import { accessTokenKey } from "../constants/access-token-key.constant";

export function createAuthParamDecorator<TAccessToken>(resolver: (token: TAccessToken) => any) {
    return createParamDecorator(function (
        _data: any,
        ctx: ExecutionContext
    ) {
        const request = ctx.switchToHttp().getRequest();
        const token: TAccessToken = request[accessTokenKey];
        return resolver(token);
    });
}
