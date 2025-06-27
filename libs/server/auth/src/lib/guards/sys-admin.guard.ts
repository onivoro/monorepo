import { Injectable, CanActivate } from '@nestjs/common';
import { AbstractAuthGuard } from '../classes/abstract-auth-guard.class';

@Injectable()
export class SysAdminGuard<TAccessToken extends { isSysAdmin?: boolean }> extends AbstractAuthGuard<TAccessToken> implements CanActivate {
  evaluateToken = (token?: TAccessToken) => !!(token && !!token.isSysAdmin);
}
