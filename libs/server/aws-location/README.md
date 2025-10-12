# @onivoro/server-aws-location

AWS Location Service integration for NestJS applications with geocoding and route calculation capabilities.

## Installation

```bash
npm install @onivoro/server-aws-location
```

## Overview

This library provides AWS Location Service integration for NestJS applications, offering geocoding and route calculation functionality.

## Module Setup

```typescript
import { Module } from '@nestjs/common';
import { ServerAwsLocationModule } from '@onivoro/server-aws-location';

@Module({
  imports: [
    ServerAwsLocationModule.configure()
  ]
})
export class AppModule {}
```

## Configuration

The module uses environment-based configuration:

```typescript
export class ServerAwsLocationConfig {
  AWS_LOCATION_INDEX_NAME: string;  // The name of your AWS Location place index
  AWS_LOCATION_CALCULATOR_NAME: string;  // The name of your AWS Location route calculator
  AWS_REGION: string;
  AWS_PROFILE?: string;  // Optional AWS profile
}
```

## Service

### LocationService

The service provides two main operations:

```typescript
import { Injectable } from '@nestjs/common';
import { LocationService } from '@onivoro/server-aws-location';

@Injectable()
export class GeocodingService {
  constructor(private readonly locationService: LocationService) {}

  // Geocode an address to coordinates
  async getCoordinates(address: string) {
    const results = await this.locationService.geocodeAddress(address);
    
    if (results && results.length > 0) {
      const location = results[0];
      return {
        lat: location.Place.Geometry.Point[1],
        lng: location.Place.Geometry.Point[0],
        label: location.Place.Label,
        confidence: location.Place.Confidence
      };
    }
    
    return null;
  }

  // Calculate route between two points
  async getRoute(startLat: number, startLng: number, endLat: number, endLng: number) {
    const route = await this.locationService.calculateRoute(
      startLat,
      startLng,
      endLat,
      endLng
    );
    
    return {
      distance: route.Summary.Distance,
      duration: route.Summary.DurationSeconds,
      legs: route.Legs
    };
  }
}
```

## Method Details

### geocodeAddress(address: string)

Converts an address string to geographic coordinates.

- **Returns**: Array of search results with place information including coordinates, labels, and confidence scores
- **Uses**: The place index configured in `AWS_LOCATION_INDEX_NAME`

### calculateRoute(startLat, startLng, endLat, endLng)

Calculates a route between two geographic points.

- **Parameters**:
  - `startLat`: Starting point latitude
  - `startLng`: Starting point longitude
  - `endLat`: Destination latitude
  - `endLng`: Destination longitude
- **Returns**: Route information including distance, duration, and turn-by-turn directions
- **Uses**: The route calculator configured in `AWS_LOCATION_CALCULATOR_NAME`

## Direct Client Access

The service exposes the underlying Location client for advanced operations:

```typescript
import { 
  GetPlaceCommand,
  SearchPlaceIndexForPositionCommand,
  BatchGetDevicePositionCommand
} from '@aws-sdk/client-location';

@Injectable()
export class AdvancedLocationService {
  constructor(private readonly locationService: LocationService) {}

  // Reverse geocoding - coordinates to address
  async reverseGeocode(lat: number, lng: number) {
    const command = new SearchPlaceIndexForPositionCommand({
      IndexName: process.env.AWS_LOCATION_INDEX_NAME,
      Position: [lng, lat] // Note: AWS Location uses [longitude, latitude]
    });
    
    return await this.locationService.locationClient.send(command);
  }

  // Get place details by ID
  async getPlaceDetails(placeId: string) {
    const command = new GetPlaceCommand({
      IndexName: process.env.AWS_LOCATION_INDEX_NAME,
      PlaceId: placeId
    });
    
    return await this.locationService.locationClient.send(command);
  }
}
```

## Complete Example

```typescript
import { Module, Injectable, Controller, Get, Query } from '@nestjs/common';
import { ServerAwsLocationModule, LocationService } from '@onivoro/server-aws-location';

@Module({
  imports: [ServerAwsLocationModule.configure()],
  controllers: [DeliveryController],
  providers: [DeliveryService]
})
export class DeliveryModule {}

@Injectable()
export class DeliveryService {
  constructor(private readonly locationService: LocationService) {}

  async calculateDeliveryRoute(pickupAddress: string, deliveryAddress: string) {
    try {
      // Geocode both addresses
      const [pickupResults, deliveryResults] = await Promise.all([
        this.locationService.geocodeAddress(pickupAddress),
        this.locationService.geocodeAddress(deliveryAddress)
      ]);

      if (!pickupResults?.length || !deliveryResults?.length) {
        throw new Error('Unable to geocode addresses');
      }

      const pickup = pickupResults[0].Place.Geometry.Point;
      const delivery = deliveryResults[0].Place.Geometry.Point;

      // Calculate route
      const route = await this.locationService.calculateRoute(
        pickup[1], // lat
        pickup[0], // lng
        delivery[1], // lat
        delivery[0]  // lng
      );

      return {
        pickup: {
          address: pickupResults[0].Place.Label,
          coordinates: { lat: pickup[1], lng: pickup[0] }
        },
        delivery: {
          address: deliveryResults[0].Place.Label,
          coordinates: { lat: delivery[1], lng: delivery[0] }
        },
        route: {
          distanceKm: route.Summary.Distance,
          durationMinutes: Math.ceil(route.Summary.DurationSeconds / 60),
          steps: route.Legs[0]?.Steps.map(step => ({
            distance: step.Distance,
            duration: step.DurationSeconds,
            instruction: step.EndPosition
          }))
        }
      };
    } catch (error) {
      console.error('Route calculation failed:', error);
      throw error;
    }
  }

  async estimateDeliveryTime(distance: number, trafficMultiplier: number = 1.2) {
    // Average delivery speed in km/h
    const averageSpeed = 40;
    const baseTime = (distance / averageSpeed) * 60; // minutes
    return Math.ceil(baseTime * trafficMultiplier);
  }
}

@Controller('delivery')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get('route')
  async getDeliveryRoute(
    @Query('pickup') pickup: string,
    @Query('delivery') delivery: string
  ) {
    return await this.deliveryService.calculateDeliveryRoute(pickup, delivery);
  }
}
```

## AWS Location Service Setup

Before using this library, you need to set up AWS Location Service resources:

1. **Create a Place Index** for geocoding:
```bash
aws location create-place-index \
  --index-name my-place-index \
  --data-source Esri \
  --pricing-plan RequestBasedUsage
```

2. **Create a Route Calculator** for routing:
```bash
aws location create-route-calculator \
  --calculator-name my-route-calculator \
  --data-source Esri \
  --pricing-plan RequestBasedUsage
```

## Environment Variables

```bash
# Required: AWS Location resource names
AWS_LOCATION_INDEX_NAME=my-place-index
AWS_LOCATION_CALCULATOR_NAME=my-route-calculator

# Required: AWS region
AWS_REGION=us-east-1

# Optional: AWS profile
AWS_PROFILE=my-profile
```

## Error Handling

```typescript
try {
  const results = await locationService.geocodeAddress('invalid address xyz123');
} catch (error) {
  if (error.name === 'ResourceNotFoundException') {
    console.error('Place index not found');
  } else if (error.name === 'ValidationException') {
    console.error('Invalid input parameters');
  }
}
```

## Limitations

- Only provides two methods: geocoding and route calculation
- No support for geofencing or device tracking
- Limited to single address geocoding (no batch operations)
- Route calculation limited to two-point routes
- For advanced features, use the exposed `locationClient` directly

## Best Practices

1. **Resource Names**: Store AWS Location resource names in environment variables
2. **Error Handling**: Always handle cases where geocoding returns no results
3. **Coordinate Order**: AWS Location uses [longitude, latitude] order
4. **Rate Limiting**: Implement appropriate rate limiting for production use
5. **Caching**: Consider caching geocoding results to reduce API calls

## License

MIT