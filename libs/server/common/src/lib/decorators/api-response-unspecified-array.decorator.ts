import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

export function ApiResponseUnspecifiedArray() {
    return applyDecorators(
        ApiResponse({
            schema: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {},
                }
            },
        }),
    );
}