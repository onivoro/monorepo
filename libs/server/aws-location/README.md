# @onivoro/server-aws-location

AWS Location Service integration for NestJS applications with geocoding and route calculation, plus Swagger-annotated DTOs for the results.

## Installation

```bash
npm install @onivoro/server-aws-location @aws-sdk/client-location @nestjs/common @nestjs/swagger
```

`@aws-sdk/client-location`, `@nestjs/common` and `@nestjs/swagger` (used by the DTOs) are peer dependencies.

## Module Setup

`ServerAwsLocationModule.configure(config)` takes the configuration object directly; the module does not read environment variables itself.

```typescript
import { Module } from '@nestjs/common';
import { ServerAwsLocationModule } from '@onivoro/server-aws-location';

@Module({
  imports: [
    ServerAwsLocationModule.configure({
      AWS_REGION: process.env.AWS_REGION!,
      PLACE_INDEX_NAME: process.env.PLACE_INDEX_NAME!,
      ROUTE_CALCULATOR_NAME: process.env.ROUTE_CALCULATOR_NAME!,
      AWS_PROFILE: process.env.AWS_PROFILE, // optional
    }),
  ],
})
export class AppModule {}
```

The module is not global. It provides and exports `LocationService`, `ServerAwsLocationConfig`, a `LocationClient` instance, and the `AwsCredentials` provider from `@onivoro/server-aws-credential-providers`.

## Configuration

```typescript
export class ServerAwsLocationConfig {
  AWS_PROFILE?: string; // optional named profile from ~/.aws
  AWS_REGION: string;
  ROUTE_CALCULATOR_NAME: string; // route calculator used by calculateRoute
  PLACE_INDEX_NAME: string; // place index used by geocodeAddress
}
```

### AWS Credentials

Credentials are resolved by [`@onivoro/server-aws-credential-providers`](../aws-credential-providers/):

- If `AWS_PROFILE` is set, credentials are loaded from that profile in the shared credentials file. If that fails, `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` (or their lowercase forms) from the environment are used.
- If `AWS_PROFILE` is not set, the client uses the AWS SDK's default credential provider chain.

## LocationService

### `geocodeAddress(address: string, maxResults = 20): Promise<GeocodingResultDto[]>`

Runs `SearchPlaceIndexForText` against `PLACE_INDEX_NAME` and maps each result to a `GeocodingResultDto`:

- `text` - the place label (`''` if missing)
- `coordinates` - `{ longitude, latitude }`
- `country`, `region`, `municipality`, `street`, `postalCode` - when present
- `relevance` - the result's relevance score (`0` if missing)

Returns `[]` when there are no results. Any failure is logged and rethrown as `BadRequestException('Failed to geocode address.')`.

### `calculateRoute(request: RouteCalculationRequestDto): Promise<RouteCalculationResultDto>`

Runs `CalculateRoute` against `ROUTE_CALCULATOR_NAME` between `departurePosition` and `destinationPosition` (each `{ longitude, latitude }`). `distanceUnit` (`'Miles' | 'Kilometers'`) and `travelMode` (`'Car' | 'Truck' | 'Bicycle' | 'Walking'`) fall back to `'Miles'` and `'Car'` when `undefined`.

Returns only the route summary:

- `distance` - total distance in `distanceUnit` (`0` if missing)
- `duration` - `{ hours, minutes }`, derived from the summary's duration seconds (remaining seconds are dropped)

Missing positions throw `BadRequestException('Invalid location data provided.')`; AWS errors are logged and rethrown as `BadRequestException('Failed to calculate route.')`.

### Example

```typescript
import { Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { LocationService } from '@onivoro/server-aws-location';

@Controller('delivery')
export class DeliveryController {
  constructor(private readonly locationService: LocationService) {}

  @Get('estimate')
  async estimate(@Query('pickup') pickup: string, @Query('dropoff') dropoff: string) {
    const [[from], [to]] = await Promise.all([this.locationService.geocodeAddress(pickup, 1), this.locationService.geocodeAddress(dropoff, 1)]);

    if (!from || !to) {
      throw new NotFoundException('Address not found');
    }

    const route = await this.locationService.calculateRoute({
      departurePosition: from.coordinates,
      destinationPosition: to.coordinates,
      distanceUnit: 'Kilometers',
      travelMode: 'Car',
    });

    return {
      from: from.text,
      to: to.text,
      distanceKm: route.distance,
      duration: route.duration, // { hours, minutes }
    };
  }
}
```

## DTOs

All DTOs are classes decorated with `@ApiProperty`, so they can be used directly in Swagger-documented controllers.

| Export                       | Fields                                                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `LocationDto`                | `longitude: number`, `latitude: number`                                                                               |
| `Coordinates`                | `longitude: number`, `latitude: number` (used by `GeocodingResultDto`)                                                |
| `GeocodingResultDto`         | `text`, `coordinates: Coordinates`, optional `country`, `region`, `municipality`, `street`, `postalCode`, `relevance` |
| `RouteCalculationRequestDto` | `departurePosition: LocationDto`, `destinationPosition: LocationDto`, `distanceUnit`, `travelMode`                    |
| `RouteCalculationResultDto`  | `distance: number`, `duration: DurationDto`                                                                           |
| `DurationDto`                | `hours: number`, `minutes: number`                                                                                    |

## Direct Client Access

The service keeps its client private, but the module exports the `LocationClient` provider, so you can inject it for operations the service doesn't cover:

```typescript
import { Injectable } from '@nestjs/common';
import { LocationClient, SearchPlaceIndexForPositionCommand } from '@aws-sdk/client-location';
import { ServerAwsLocationConfig } from '@onivoro/server-aws-location';

@Injectable()
export class ReverseGeocodingService {
  constructor(
    private readonly locationClient: LocationClient,
    private readonly config: ServerAwsLocationConfig,
  ) {}

  reverseGeocode(longitude: number, latitude: number) {
    return this.locationClient.send(
      new SearchPlaceIndexForPositionCommand({
        IndexName: this.config.PLACE_INDEX_NAME,
        Position: [longitude, latitude], // AWS Location uses [longitude, latitude]
      }),
    );
  }
}
```

## AWS Location Service Setup

Create the place index and route calculator the module is configured with:

```bash
aws location create-place-index \
  --index-name my-place-index \
  --data-source Esri

aws location create-route-calculator \
  --calculator-name my-route-calculator \
  --data-source Esri
```

## Exports

- `ServerAwsLocationModule` - dynamic module with `configure(config)`
- `ServerAwsLocationConfig` - configuration class (also injectable)
- `LocationService` - `geocodeAddress`, `calculateRoute`
- `LocationDto`, `Coordinates`, `GeocodingResultDto`, `RouteCalculationRequestDto`, `RouteCalculationResultDto`, `DurationDto`

## License

MIT
