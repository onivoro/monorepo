
import { ExecutionContext, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { idTokenKey } from "../constants/id-token-key.constant";

export function authorizeRequest<TAccessToken>(context: ExecutionContext, evaluator?: (token?: TAccessToken, request?: any) => boolean, errorMessage?: string): boolean {
    const request = context.switchToHttp().getRequest();
    const token: TAccessToken = request[idTokenKey];

    if (!token) {
        throw new UnauthorizedException();
    }

    if(evaluator && !evaluator(token, request)) {
        throw new ForbiddenException(errorMessage);
    }

    return true;
}