
import { ExecutionContext, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { accessTokenKey } from "../constants/access-token-key.constant";
import { ICognitoAccessToken } from "../types/cognito-access-token.interface";

export function authorizeRequestByAccessToken(context: ExecutionContext, evaluator?: (token?: ICognitoAccessToken, request?: any) => boolean, errorMessage?: string): boolean {
    const request = context.switchToHttp().getRequest();
    const token: ICognitoAccessToken = request[accessTokenKey];

    if (!token) {
        throw new UnauthorizedException();
    }

    if (evaluator && !evaluator(token, request)) {
        throw new ForbiddenException(errorMessage);
    }

    return true;
}