import { IAccessToken } from '@onivoro/isomorphic/common';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { accessTokenKey } from '../constants/access-token-key.constant';

export const UserId = createParamDecorator(function (
  _data: any,
  ctx: ExecutionContext
) {
  const request = ctx.switchToHttp().getRequest();

  const token = ((request[accessTokenKey]) as IAccessToken);

  if(token.type === 'user') {
    return token.id;
  }
});
