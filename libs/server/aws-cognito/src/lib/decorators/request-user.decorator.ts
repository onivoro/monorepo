import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { requestUserKey } from '../constants/request-user-key.constant';

export const RequestUser = createParamDecorator(function (
  _data: any,
  ctx: ExecutionContext
) {
  const request = ctx.switchToHttp().getRequest();

  return (request[requestUserKey] as any);
});
