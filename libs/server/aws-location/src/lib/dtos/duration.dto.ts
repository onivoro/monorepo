import { ApiProperty } from '@nestjs/swagger';

export class DurationDto {
    @ApiProperty({
        description: 'Duration hours component',
        type: Number,
        example: 2
    })
    hours: number;

    @ApiProperty({
        description: 'Duration minutes component',
        type: Number,
        example: 30
    })
    minutes: number;
}