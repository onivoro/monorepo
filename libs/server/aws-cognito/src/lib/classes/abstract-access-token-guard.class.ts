import { CanActivate, ExecutionContext } from '@nestjs/common';
import { authorizeRequestByAccessToken } from '../functions/authorize-request-by-access-token.function';
import { ICognitoAccessToken } from '../types/cognito-access-token.interface';

export abstract class AbstractAccessTokenGuard implements CanActivate {
  canActivate(
    context: ExecutionContext
  ) {
    return authorizeRequestByAccessToken(context, (token, request) => this.evaluateToken(token, request));
  };

  abstract evaluateToken: (token?: ICognitoAccessToken, request?: any) => boolean;
}
