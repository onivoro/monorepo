import { applyDecorators } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';

export function ApiQuerySortParams() {
  return applyDecorators(
    ApiQuery({ name: 'sortKey', required: false }),
    ApiQuery({ name: 'sortDirection', required: false, enum: ['asc', 'desc'] }),
  );
}