
import { ExecutionContext, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { idTokenKey } from "../constants/id-token-key.constant";
import { ICognitoIdentityToken } from "../types/cognito-identity-token.interface";

export function authorizeRequestByIdToken(context: ExecutionContext, evaluator?: (token?: ICognitoIdentityToken, request?: any) => boolean, errorMessage?: string): boolean {
    const request = context.switchToHttp().getRequest();
    const token: ICognitoIdentityToken = request[idTokenKey];

    if (!token) {
        throw new UnauthorizedException();
    }

    if (evaluator && !evaluator(token, request)) {
        throw new ForbiddenException(errorMessage);
    }

    return true;
}