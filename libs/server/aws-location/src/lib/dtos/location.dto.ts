import { ApiProperty } from "@nestjs/swagger";

export class LocationDto {
    @ApiProperty({ type: 'number' }) longitude: number;
    @ApiProperty({ type: 'number' }) latitude: number;
}
