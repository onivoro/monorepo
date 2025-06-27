import { IAccessToken } from '@onivoro/isomorphic/common';
import { CanActivate } from '@nestjs/common';
import { AbstractAuthGuard } from '../classes/abstract-auth-guard.class';

export class HasTokenGuard extends AbstractAuthGuard<IAccessToken> implements CanActivate {
    evaluateToken = (token?: IAccessToken) => !!token;
}
