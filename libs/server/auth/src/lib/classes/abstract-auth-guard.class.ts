import { CanActivate, ExecutionContext } from '@nestjs/common';
import { authorizeRequest } from '../functions/authorize-request.function';

export abstract class AbstractAuthGuard<TAccessToken> implements CanActivate {
  canActivate(
    context: ExecutionContext
  ) {
    return authorizeRequest<TAccessToken>(context, (token, request) => this.evaluateToken(token, request));
  };

  abstract evaluateToken: (token?: TAccessToken, request?: any) => boolean;
}
