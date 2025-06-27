import { applyDecorators, Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

export const DefaultApiController = (args: any) => {
    return applyDecorators(
        Controller(args),
        ApiTags('Default')
    );
}