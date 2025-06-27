import { applyDecorators } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';

export function ApiQueryPagedParams() {
  return applyDecorators(
    ApiQuery({ name: 'pagingKey', required: false }),
    ApiQuery({ name: 'pageSize', required: false }),
  );
}