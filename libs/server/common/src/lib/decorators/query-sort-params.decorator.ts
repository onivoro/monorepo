import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export type TQuerySortParams = {
  sortKey?: string | undefined,
  sortDirection?: 'asc' | 'desc' | undefined,
};

export const QuerySortParams = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const { sortKey, sortDirection, sortkey, sortdirection } = request.query || {};

    return {
      sortKey: sortKey || sortkey || undefined,
      sortDirection: sortDirection || sortdirection || undefined,
    }
  },
);