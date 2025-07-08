import { ApiProperty } from '@nestjs/swagger';
import { DurationDto } from './duration.dto';

export class RouteCalculationResultDto {
    @ApiProperty({
        description: 'Total distance of the route',
        type: Number,
        example: 150.5
    })
    distance: number;

    @ApiProperty({
        description: 'Duration of the route broken down into hours and minutes',
        type: DurationDto
    })
    duration: DurationDto;
}