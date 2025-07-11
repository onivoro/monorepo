# @onivoro/server-aws-location

A NestJS module for integrating with AWS Location Service, providing geocoding, route calculation, and location-based services for your server applications.

## Installation

```bash
npm install @onivoro/server-aws-location
```

## Features

- **AWS Location Service Integration**: Direct integration with AWS Location Service
- **Route Calculation**: Calculate routes between locations with distance and duration
- **Geocoding**: Convert addresses to geographic coordinates
- **Place Search**: Search for places using text queries
- **Multi-Modal Routing**: Support for Car, Truck, Bicycle, and Walking travel modes
- **Distance Units**: Support for both Miles and Kilometers
- **Environment-Based Configuration**: Configurable location settings per environment
- **Credential Provider Integration**: Seamless integration with AWS credential providers

## Quick Start

### 1. Module Configuration

```typescript
import { ServerAwsLocationModule } from '@onivoro/server-aws-location';

@Module({
  imports: [
    ServerAwsLocationModule.configure({
      AWS_REGION: 'us-east-1',
      ROUTE_CALCULATOR_NAME: process.env.AWS_LOCATION_ROUTE_CALCULATOR,
      PLACE_INDEX_NAME: process.env.AWS_LOCATION_PLACE_INDEX,
      AWS_PROFILE: process.env.AWS_PROFILE || 'default',
    }),
  ],
})
export class AppModule {}
```

### 2. Basic Usage

```typescript
import { LocationService } from '@onivoro/server-aws-location';

@Injectable()
export class RoutingService {
  constructor(private locationService: LocationService) {}

  async getRoute(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
    const result = await this.locationService.calculateRoute({
      departurePosition: { latitude: from.lat, longitude: from.lng },
      destinationPosition: { latitude: to.lat, longitude: to.lng },
      travelMode: 'Car',
      distanceUnit: 'Miles'
    });

    return {
      distance: result.distance,
      duration: `${result.duration.hours}h ${result.duration.minutes}m`
    };
  }

  async geocodeAddress(address: string) {
    const results = await this.locationService.geocodeAddress(address);

    return results.map(result => ({
      address: result.text,
      coordinates: result.coordinates,
      confidence: result.relevance
    }));
  }
}
```

## Configuration

### ServerAwsLocationConfig

```typescript
import { ServerAwsLocationConfig } from '@onivoro/server-aws-location';

export class AppLocationConfig extends ServerAwsLocationConfig {
  AWS_REGION = process.env.AWS_REGION || 'us-east-1';
  AWS_PROFILE = process.env.AWS_PROFILE || 'default';
  ROUTE_CALCULATOR_NAME = process.env.AWS_LOCATION_ROUTE_CALCULATOR || 'MyRouteCalculator';
  PLACE_INDEX_NAME = process.env.AWS_LOCATION_PLACE_INDEX || 'MyPlaceIndex';
}
```

### Environment Variables

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_PROFILE=default

# AWS Location Service Configuration
AWS_LOCATION_ROUTE_CALCULATOR=MyRouteCalculator
AWS_LOCATION_PLACE_INDEX=MyPlaceIndex
```

## Usage Examples

### Wrapping With Controllers

```typescript
// route-calculation.controller.ts
import { Body, Post } from "@nestjs/common";
import { ApiBody, ApiResponse } from "@nestjs/swagger";
import { DefaultApiController } from "@onivoro/server-common"; // optional
import { LocationService, RouteCalculationRequestDto, RouteCalculationResultDto } from "@onivoro/server-aws-location";

@DefaultApiController('route-calculation')
export class RouteCalculationController {
    constructor(private locationService: LocationService) { }

    @Post()
    @ApiBody({ type: RouteCalculationRequestDto })
    @ApiResponse({ type: RouteCalculationResultDto })
    async post(@Body() body: RouteCalculationRequestDto) {
        return this.locationService.calculateRoute(body);
    }
}
```

```typescript
// geolocation.controller.ts
import { Get, Param } from "@nestjs/common";
import { ApiParam, ApiResponse } from "@nestjs/swagger";
import { DefaultApiController } from "@onivoro/server-common"; // optional
import { LocationService, GeocodingResultDto } from "@onivoro/server-aws-location";

@DefaultApiController('geolocation')
export class GeolocationController {
    constructor(private locationService: LocationService) { }

    @Get(':address')
    @ApiParam({ type: 'string', name: 'address' })
    @ApiResponse({ type: GeocodingResultDto, isArray: true })
    async post(@Param('address') value: string): Promise<GeocodingResultDto[]> {
        return this.locationService.geocodeAddress(value);
    }
}
```

### Route Optimization Service

```typescript
import { LocationService } from '@onivoro/server-aws-location';
import { RouteCalculationRequestDto, RouteCalculationResultDto } from '@onivoro/server-aws-location';

@Injectable()
export class RouteOptimizationService {
  constructor(private locationService: LocationService) {}

  async findOptimalRoute(
    waypoints: Array<{ lat: number; lng: number; name: string }>,
    travelMode: 'Car' | 'Truck' | 'Bicycle' | 'Walking' = 'Car'
  ) {
    const routes: Array<{
      from: string;
      to: string;
      distance: number;
      duration: { hours: number; minutes: number };
    }> = [];

    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i];
      const to = waypoints[i + 1];

      const route = await this.locationService.calculateRoute({
        departurePosition: { latitude: from.lat, longitude: from.lng },
        destinationPosition: { latitude: to.lat, longitude: to.lng },
        travelMode,
        distanceUnit: 'Miles'
      });

      routes.push({
        from: from.name,
        to: to.name,
        distance: route.distance,
        duration: route.duration
      });
    }

    const totalDistance = routes.reduce((sum, route) => sum + route.distance, 0);
    const totalMinutes = routes.reduce(
      (sum, route) => sum + (route.duration.hours * 60) + route.duration.minutes,
      0
    );

    return {
      routes,
      totalDistance,
      totalDuration: {
        hours: Math.floor(totalMinutes / 60),
        minutes: totalMinutes % 60
      }
    };
  }

  async compareRoutes(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ) {
    const travelModes: Array<'Car' | 'Truck' | 'Bicycle' | 'Walking'> =
      ['Car', 'Truck', 'Bicycle', 'Walking'];

    const comparisons = await Promise.all(
      travelModes.map(async mode => {
        try {
          const route = await this.locationService.calculateRoute({
            departurePosition: { latitude: origin.lat, longitude: origin.lng },
            destinationPosition: { latitude: destination.lat, longitude: destination.lng },
            travelMode: mode,
            distanceUnit: 'Miles'
          });

          return {
            mode,
            distance: route.distance,
            duration: route.duration,
            totalMinutes: (route.duration.hours * 60) + route.duration.minutes
          };
        } catch (error) {
          // Some modes might not be available for certain routes
          return null;
        }
      })
    );

    return comparisons
      .filter(Boolean)
      .sort((a, b) => a!.totalMinutes - b!.totalMinutes);
  }
}
```

### Geocoding and Address Validation Service

```typescript
import { LocationService, GeocodingResultDto } from '@onivoro/server-aws-location';

@Injectable()
export class AddressValidationService {
  constructor(private locationService: LocationService) {}

  async validateAddress(address: string): Promise<{
    isValid: boolean;
    suggestedAddress?: GeocodingResultDto;
    alternatives?: GeocodingResultDto[];
  }> {
    try {
      const results = await this.locationService.geocodeAddress(address, 5);

      if (results.length === 0) {
        return { isValid: false };
      }

      const topResult = results[0];
      const isHighConfidence = topResult.relevance > 0.9;

      return {
        isValid: isHighConfidence,
        suggestedAddress: topResult,
        alternatives: results.slice(1)
      };
    } catch (error) {
      console.error('Address validation failed:', error);
      return { isValid: false };
    }
  }

  async enrichAddress(partialAddress: string) {
    const results = await this.locationService.geocodeAddress(partialAddress, 1);

    if (results.length === 0) {
      throw new Error('Address not found');
    }

    const result = results[0];

    return {
      fullAddress: result.text,
      coordinates: result.coordinates,
      components: {
        street: result.street,
        municipality: result.municipality,
        region: result.region,
        country: result.country,
        postalCode: result.postalCode
      }
    };
  }

  async reverseGeocode(latitude: number, longitude: number) {
    // Note: This would require implementing reverse geocoding in the LocationService
    // For now, this is a placeholder showing the expected interface
    throw new Error('Reverse geocoding not yet implemented');
  }
}
```

### Delivery Route Service

```typescript
@Injectable()
export class DeliveryRouteService {
  constructor(
    private locationService: LocationService,
    private logger: Logger
  ) {}

  async planDeliveryRoute(
    warehouse: { address: string },
    deliveries: Array<{ id: string; address: string; priority: number }>
  ) {
    // Geocode all addresses
    const warehouseLocation = await this.geocodeLocation(warehouse.address);
    const deliveryLocations = await Promise.all(
      deliveries.map(async delivery => ({
        ...delivery,
        location: await this.geocodeLocation(delivery.address)
      }))
    );

    // Sort by priority
    deliveryLocations.sort((a, b) => b.priority - a.priority);

    // Calculate routes
    const routes = [];
    let currentLocation = warehouseLocation;

    for (const delivery of deliveryLocations) {
      const route = await this.locationService.calculateRoute({
        departurePosition: {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude
        },
        destinationPosition: {
          latitude: delivery.location.latitude,
          longitude: delivery.location.longitude
        },
        travelMode: 'Truck',
        distanceUnit: 'Miles'
      });

      routes.push({
        deliveryId: delivery.id,
        address: delivery.address,
        distance: route.distance,
        duration: route.duration
      });

      currentLocation = delivery.location;
    }

    // Calculate return to warehouse
    const returnRoute = await this.locationService.calculateRoute({
      departurePosition: {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude
      },
      destinationPosition: {
        latitude: warehouseLocation.latitude,
        longitude: warehouseLocation.longitude
      },
      travelMode: 'Truck',
      distanceUnit: 'Miles'
    });

    return {
      deliveries: routes,
      returnToWarehouse: returnRoute,
      totalDistance: routes.reduce((sum, r) => sum + r.distance, 0) + returnRoute.distance,
      estimatedTime: this.calculateTotalTime(routes, returnRoute)
    };
  }

  private async geocodeLocation(address: string) {
    const results = await this.locationService.geocodeAddress(address, 1);

    if (results.length === 0) {
      throw new Error(`Unable to geocode address: ${address}`);
    }

    return results[0].coordinates;
  }

  private calculateTotalTime(
    routes: Array<{ duration: { hours: number; minutes: number } }>,
    returnRoute: { duration: { hours: number; minutes: number } }
  ) {
    const totalMinutes = routes.reduce(
      (sum, route) => sum + (route.duration.hours * 60) + route.duration.minutes,
      0
    ) + (returnRoute.duration.hours * 60) + returnRoute.duration.minutes;

    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60
    };
  }
}
```

## Advanced Usage

### Batch Geocoding with Caching

```typescript
@Injectable()
export class CachedGeocodingService {
  private geocodeCache = new Map<string, GeocodingResultDto[]>();

  constructor(private locationService: LocationService) {}

  async batchGeocode(addresses: string[]) {
    const results = new Map<string, GeocodingResultDto[]>();
    const uncachedAddresses: string[] = [];

    // Check cache first
    for (const address of addresses) {
      const cached = this.geocodeCache.get(address);
      if (cached) {
        results.set(address, cached);
      } else {
        uncachedAddresses.push(address);
      }
    }

    // Geocode uncached addresses
    const geocodePromises = uncachedAddresses.map(async address => {
      try {
        const geocoded = await this.locationService.geocodeAddress(address);
        this.geocodeCache.set(address, geocoded);
        results.set(address, geocoded);
      } catch (error) {
        console.error(`Failed to geocode: ${address}`, error);
        results.set(address, []);
      }
    });

    await Promise.all(geocodePromises);

    return results;
  }

  clearCache() {
    this.geocodeCache.clear();
  }
}
```

### Distance Matrix Service

```typescript
@Injectable()
export class DistanceMatrixService {
  constructor(private locationService: LocationService) {}

  async calculateDistanceMatrix(
    origins: Array<{ name: string; lat: number; lng: number }>,
    destinations: Array<{ name: string; lat: number; lng: number }>,
    travelMode: 'Car' | 'Truck' | 'Bicycle' | 'Walking' = 'Car'
  ) {
    const matrix: Array<Array<{
      distance: number;
      duration: { hours: number; minutes: number };
    }>> = [];

    for (const origin of origins) {
      const row = [];

      for (const destination of destinations) {
        try {
          const route = await this.locationService.calculateRoute({
            departurePosition: { latitude: origin.lat, longitude: origin.lng },
            destinationPosition: { latitude: destination.lat, longitude: destination.lng },
            travelMode,
            distanceUnit: 'Miles'
          });

          row.push({
            distance: route.distance,
            duration: route.duration
          });
        } catch (error) {
          row.push({
            distance: -1,
            duration: { hours: -1, minutes: -1 }
          });
        }
      }

      matrix.push(row);
    }

    return {
      origins: origins.map(o => o.name),
      destinations: destinations.map(d => d.name),
      matrix,
      travelMode
    };
  }

  findNearestDestination(
    origin: { name: string; lat: number; lng: number },
    destinations: Array<{ name: string; lat: number; lng: number }>
  ) {
    return this.calculateDistanceMatrix([origin], destinations).then(result => {
      const distances = result.matrix[0];
      let nearestIndex = -1;
      let shortestDistance = Infinity;

      distances.forEach((route, index) => {
        if (route.distance > 0 && route.distance < shortestDistance) {
          shortestDistance = route.distance;
          nearestIndex = index;
        }
      });

      if (nearestIndex === -1) {
        return null;
      }

      return {
        destination: destinations[nearestIndex],
        distance: distances[nearestIndex].distance,
        duration: distances[nearestIndex].duration
      };
    });
  }
}
```

## DTOs

### RouteCalculationRequestDto

```typescript
import { RouteCalculationRequestDto } from '@onivoro/server-aws-location';

const routeRequest: RouteCalculationRequestDto = {
  departurePosition: { latitude: 40.7128, longitude: -74.0060 },
  destinationPosition: { latitude: 42.3601, longitude: -71.0589 },
  distanceUnit: 'Miles',
  travelMode: 'Car'
};
```

### GeocodingResultDto

```typescript
interface GeocodingResultDto {
  text: string;
  relevance: number;
  coordinates: {
    longitude: number;
    latitude: number;
  };
  country?: string;
  region?: string;
  municipality?: string;
  street?: string;
  postalCode?: string;
}
```

## Best Practices

### 1. Error Handling

```typescript
async safeCalculateRoute(request: RouteCalculationRequestDto) {
  try {
    return await this.locationService.calculateRoute(request);
  } catch (error: any) {
    if (error.name === 'ResourceNotFoundException') {
      throw new Error('Route calculator not configured');
    } else if (error.name === 'ValidationException') {
      throw new Error('Invalid coordinates provided');
    }
    throw error;
  }
}
```

### 2. Rate Limiting

```typescript
// Implement rate limiting for API calls
const RATE_LIMIT = 10; // requests per second
const INTERVAL = 1000 / RATE_LIMIT;

let lastCallTime = 0;

async function rateLimitedCall<T>(fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const timeSinceLastCall = now - lastCallTime;

  if (timeSinceLastCall < INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, INTERVAL - timeSinceLastCall));
  }

  lastCallTime = Date.now();
  return fn();
}
```

### 3. Coordinate Validation

```typescript
function validateCoordinates(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}
```

## Testing

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ServerAwsLocationModule, LocationService } from '@onivoro/server-aws-location';

describe('LocationService', () => {
  let service: LocationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ServerAwsLocationModule.configure({
        AWS_REGION: 'us-east-1',
        ROUTE_CALCULATOR_NAME: 'test-calculator',
        PLACE_INDEX_NAME: 'test-index',
        AWS_PROFILE: 'test'
      })],
    }).compile();

    service = module.get<LocationService>(LocationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

## API Reference

### Exported Classes
- `ServerAwsLocationConfig`: Configuration class for AWS Location Service settings
- `ServerAwsLocationModule`: NestJS module for AWS Location Service integration

### Exported Services
- `LocationService`: Main service for route calculation and geocoding

### Exported DTOs
- `RouteCalculationRequestDto`: Request parameters for route calculation
- `RouteCalculationResultDto`: Route calculation response
- `GeocodingResultDto`: Geocoding response
- `LocationDto`: Basic location coordinates
- `DurationDto`: Time duration representation

## License

This library is licensed under the MIT License. See the LICENSE file in this package for details.
