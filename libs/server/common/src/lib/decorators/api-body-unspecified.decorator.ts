import { applyDecorators } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';

export function ApiBodyUnspecified() {
    return applyDecorators(
        ApiBody({
            schema: {
                type: 'object',
                properties: {},
            },
        }),
    );
}