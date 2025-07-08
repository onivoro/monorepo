import { ApiProperty } from '@nestjs/swagger';
import { LocationDto } from './location.dto';

export class RouteCalculationRequestDto {
    @ApiProperty({ type: LocationDto }) departurePosition: LocationDto;
    @ApiProperty({ type: LocationDto }) destinationPosition: LocationDto;
    @ApiProperty({ description: "'Miles' | 'Kilometers'", type: 'string' }) distanceUnit: 'Miles' | 'Kilometers';
    @ApiProperty({ description: "'Car' | 'Truck' | 'Bicycle' | 'Walking'", type: 'string' }) travelMode: 'Car' | 'Truck' | 'Bicycle' | 'Walking';
}