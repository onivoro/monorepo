import { CanActivate, ExecutionContext } from '@nestjs/common';
import { authorizeRequestByIdToken } from '../functions/authorize-request-by-id-token.function';
import { ICognitoIdentityToken } from '../types/cognito-identity-token.interface';

export abstract class AbstractIdTokenGuard implements CanActivate {
  canActivate(
    context: ExecutionContext
  ) {
    return authorizeRequestByIdToken(context, (token, request) => this.evaluateToken(token, request));
  };

  abstract evaluateToken: (token?: ICognitoIdentityToken, request?: any) => boolean;
}
