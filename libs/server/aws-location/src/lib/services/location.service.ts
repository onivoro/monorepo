import { LocationClient, CalculateRouteCommand, CalculateRouteCommandInput, SearchPlaceIndexForTextCommand, SearchPlaceIndexForTextCommandInput } from "@aws-sdk/client-location";
import { BadRequestException, Injectable } from "@nestjs/common";
import { RouteCalculationResultDto } from "../dtos/route-calculation-result.dto";
import { ServerAwsLocationConfig } from "../server-aws-location-config.class";
import { RouteCalculationRequestDto } from "../dtos/route-calculation-request.dto";
import { GeocodingResultDto } from "../dtos/geocoding-result.dto";

@Injectable()
export class LocationService {
    constructor(private locationClient: LocationClient, private config: ServerAwsLocationConfig) { }

    async calculateRoute(request: RouteCalculationRequestDto): Promise<RouteCalculationResultDto> {
        const calculateRouteCommandInput: CalculateRouteCommandInput = {
            CalculatorName: this.config.ROUTE_CALCULATOR_NAME,
            DeparturePosition: [],
            DestinationPosition: [],
            TravelMode: 'Car',
            DistanceUnit: 'Miles',
        };

        try {
            const { distanceUnit = 'Miles', travelMode = 'Car', departurePosition, destinationPosition } = request;

            calculateRouteCommandInput.DeparturePosition = [departurePosition.longitude, departurePosition.latitude];
            calculateRouteCommandInput.DestinationPosition = [destinationPosition.longitude, destinationPosition.latitude];
            calculateRouteCommandInput.DistanceUnit = distanceUnit;
            calculateRouteCommandInput.TravelMode = travelMode;

        } catch (error: any) {
            console.error({ error, detail: 'An error occurred while setting positions.', request });
            throw new BadRequestException('Invalid location data provided.');
        }

        try {
            const command = new CalculateRouteCommand(calculateRouteCommandInput);
            const response = await this.locationClient.send(command);

            const distance = response?.Summary?.Distance || 0;
            const durationSeconds = response?.Summary?.DurationSeconds || 0;

            const hours = Math.floor(durationSeconds / 3600);
            const minutes = Math.floor((durationSeconds % 3600) / 60);

            return {
                distance,
                duration: {
                    hours,
                    minutes,
                },
            } as RouteCalculationResultDto;
        } catch (error: any) {
            console.error({ error, detail: 'An error occurred while calculating the route.', calculateRouteCommandInput });
            throw new BadRequestException('Failed to calculate route.');
        }
    }

    async geocodeAddress(address: string, maxResults = 20): Promise<GeocodingResultDto[]> {
        try {
            const input: SearchPlaceIndexForTextCommandInput = {
                IndexName: this.config.PLACE_INDEX_NAME,
                Text: address,
                MaxResults: maxResults
            };

            const command = new SearchPlaceIndexForTextCommand(input);
            const response = await this.locationClient.send(command);

            return response.Results?.filter(Boolean)?.map(result => ({
                text: result?.Place?.Label || '',
                relevance: result?.Relevance || 0,
                coordinates: {
                    longitude: (result?.Place?.Geometry?.Point || [])[0],
                    latitude: (result?.Place?.Geometry?.Point || [])[1]
                },
                country: result?.Place?.Country,
                region: result?.Place?.Region,
                municipality: result?.Place?.Municipality,
                street: result?.Place?.Street,
                postalCode: result?.Place?.PostalCode
            })) || [];
        } catch (error: any) {
            console.error({ error, detail: 'An error occurred while geocoding the address.', address });
            throw new BadRequestException('Failed to geocode address.');
        }
    }
}