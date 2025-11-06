import { CanActivate } from '@nestjs/common';
import { Request } from 'express';
import { AbstractAccessTokenGuard } from '../classes/abstract-access-token-guard.class';
import { ICognitoAccessToken } from '../types/cognito-access-token.interface';

export class HasAccessTokenGuard extends AbstractAccessTokenGuard implements CanActivate {
    evaluateToken = (token: ICognitoAccessToken | undefined, request?: Request) => !!token;
}
