import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

export function ApiResponseUnspecified() {
    return applyDecorators(
        ApiResponse({
            schema: {
                type: 'object',
                properties: {},
            },
        }),
    );
}