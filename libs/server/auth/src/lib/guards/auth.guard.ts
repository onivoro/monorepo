import { Injectable, CanActivate } from '@nestjs/common';
import { AbstractAuthGuard } from '../classes/abstract-auth-guard.class';

@Injectable()
export class AuthGuard<TAccessToken> extends AbstractAuthGuard<TAccessToken> implements CanActivate {
  evaluateToken = (token?: TAccessToken) => !!token;
}
