import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const AccessTokenHeader = createParamDecorator(function (
  _data: any,
  ctx: ExecutionContext
) {
  const request = ctx.switchToHttp().getRequest();

  const raw = request['headers']['authorization'];
  return raw
    ? raw.replace('Bearer ', '')
    : '';
});
