import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { idTokenKey } from '../constants/id-token-key.constant';
import { ICognitoIdentityToken } from '../types/cognito-identity-token.interface';

export const IdTokenEmail = createParamDecorator(function (
  _data: any,
  ctx: ExecutionContext
) {
  const request = ctx.switchToHttp().getRequest();

  return (request[idTokenKey] as ICognitoIdentityToken)?.email;
});
