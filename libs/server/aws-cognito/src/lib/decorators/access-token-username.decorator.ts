import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { accessTokenKey } from '../constants/access-token-key.constant';
import { ICognitoAccessToken } from '../types/cognito-access-token.interface';

export const AccessTokenUsername = createParamDecorator(function (
  _data: any,
  ctx: ExecutionContext
) {
  const request = ctx.switchToHttp().getRequest();

  const cognitoAccessToken: ICognitoAccessToken = request[accessTokenKey];
  return cognitoAccessToken.username ?? cognitoAccessToken['cognito:username'];
});
