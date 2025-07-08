import { ApiProperty } from "@nestjs/swagger";

export class Coordinates {
    @ApiProperty({ type: 'number' }) longitude: number;
    @ApiProperty({ type: 'number' }) latitude: number;
}

export class GeocodingResultDto {
    @ApiProperty({ description: 'The full address text' })
    text: string;

    @ApiProperty({ description: 'The coordinates of the location' })
    coordinates: Coordinates;

    @ApiProperty({ description: 'The country of the location', required: false })
    country?: string;

    @ApiProperty({ description: 'The region/state of the location', required: false })
    region?: string;

    @ApiProperty({ description: 'The municipality/city of the location', required: false })
    municipality?: string;

    @ApiProperty({ description: 'The street address', required: false })
    street?: string;

    @ApiProperty({ description: 'The postal code', required: false })
    postalCode?: string;

    @ApiProperty({ description: 'The probabilistic relevance of the geocoded result', required: false })
    relevance?: number;
}
