import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export type TQueryPagedParams = {
  pageSize?: number | undefined,
  pagingKey?: number | undefined,
};

export const QueryPagedParams = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const { pageSize, pagingKey, pagesize, pagingkey } = request.query || {};

    return {
      pageSize: Number(pageSize || pagesize) || undefined,
      pagingKey: Number(pagingKey || pagingkey) || undefined,
    }
  },
);