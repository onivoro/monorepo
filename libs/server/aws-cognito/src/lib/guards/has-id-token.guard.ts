import { CanActivate } from '@nestjs/common';
import { ICognitoIdentityToken } from '../types/cognito-identity-token.interface';
import { Request } from 'express';
import { AbstractIdTokenGuard } from '../classes/abstract-id-token-guard.class';

export class HasIdTokenGuard extends AbstractIdTokenGuard implements CanActivate {
    evaluateToken = (token: ICognitoIdentityToken | undefined, request?: Request) => !!token;
}
