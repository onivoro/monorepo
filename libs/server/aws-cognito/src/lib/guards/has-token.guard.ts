import { CanActivate } from '@nestjs/common';
import { AbstractAuthGuard } from '../classes/abstract-auth-guard.class';
import { ICognitoIdentityToken } from '../types/cognito-identity-token.interface';
import { Request } from 'express';

export class HasTokenGuard extends AbstractAuthGuard<ICognitoIdentityToken> implements CanActivate {
    evaluateToken = (token: ICognitoIdentityToken | undefined, request?: Request) => !!token;
}
