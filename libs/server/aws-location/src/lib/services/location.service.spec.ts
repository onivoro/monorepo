import {
  CalculateRouteCommand,
  LocationClient,
  SearchPlaceIndexForTextCommand,
} from '@aws-sdk/client-location';
import { BadRequestException } from '@nestjs/common';
import { LocationService } from './location.service';
import { ServerAwsLocationConfig } from '../server-aws-location-config.class';
import { RouteCalculationRequestDto } from '../dtos/route-calculation-request.dto';

describe(LocationService.name, () => {
  let service: LocationService;
  let mockSend: jest.Mock;
  const config: ServerAwsLocationConfig = {
    AWS_REGION: 'us-east-1',
    ROUTE_CALCULATOR_NAME: 'my-calculator',
    PLACE_INDEX_NAME: 'my-index',
  };

  const request: RouteCalculationRequestDto = {
    departurePosition: { longitude: -122.33, latitude: 47.61 },
    destinationPosition: { longitude: -122.68, latitude: 45.52 },
    distanceUnit: 'Kilometers',
    travelMode: 'Truck',
  };

  beforeEach(() => {
    mockSend = jest.fn();
    service = new LocationService(
      { send: mockSend } as unknown as LocationClient,
      config,
    );
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('calculateRoute', () => {
    it('sends a CalculateRouteCommand with [longitude, latitude] positions', async () => {
      mockSend.mockResolvedValue({
        Summary: { Distance: 280.4, DurationSeconds: 3 * 3600 + 15 * 60 + 59 },
      });

      await expect(service.calculateRoute(request)).resolves.toEqual({
        distance: 280.4,
        duration: { hours: 3, minutes: 15 },
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command).toBeInstanceOf(CalculateRouteCommand);
      expect(command.input).toEqual({
        CalculatorName: 'my-calculator',
        DeparturePosition: [-122.33, 47.61],
        DestinationPosition: [-122.68, 45.52],
        DistanceUnit: 'Kilometers',
        TravelMode: 'Truck',
      });
    });

    it('defaults to Miles and Car when unit and mode are omitted', async () => {
      mockSend.mockResolvedValue({
        Summary: { Distance: 1, DurationSeconds: 60 },
      });

      await service.calculateRoute({
        departurePosition: request.departurePosition,
        destinationPosition: request.destinationPosition,
      } as RouteCalculationRequestDto);

      const { input } = mockSend.mock.calls[0][0];
      expect(input.DistanceUnit).toBe('Miles');
      expect(input.TravelMode).toBe('Car');
    });

    it.each([
      [0, 0, 0],
      [59, 0, 0],
      [60, 0, 1],
      [3599, 0, 59],
      [3600, 1, 0],
      [90061, 25, 1],
    ])(
      'converts %p seconds into %p hours and %p minutes',
      async (DurationSeconds, hours, minutes) => {
        mockSend.mockResolvedValue({
          Summary: { Distance: 5, DurationSeconds },
        });

        const result = await service.calculateRoute(request);

        expect(result.duration).toEqual({ hours, minutes });
      },
    );

    it.each([
      ['an empty response', {}],
      ['an undefined response', undefined],
      ['a summary without values', { Summary: {} }],
    ])('returns zeros for %s', async (_label, response) => {
      mockSend.mockResolvedValue(response);

      await expect(service.calculateRoute(request)).resolves.toEqual({
        distance: 0,
        duration: { hours: 0, minutes: 0 },
      });
    });

    it.each([
      ['departurePosition', { ...request, departurePosition: undefined }],
      ['destinationPosition', { ...request, destinationPosition: undefined }],
    ])(
      'throws BadRequestException without calling AWS when %s is missing',
      async (_label, badRequest) => {
        const promise = service.calculateRoute(badRequest as any);

        await expect(promise).rejects.toBeInstanceOf(BadRequestException);
        await expect(promise).rejects.toThrow(
          'Invalid location data provided.',
        );
        expect(mockSend).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith(
          expect.objectContaining({
            detail: 'An error occurred while setting positions.',
            request: badRequest,
          }),
        );
      },
    );

    it('throws BadRequestException when the client fails', async () => {
      const error = new Error('ResourceNotFoundException');
      mockSend.mockRejectedValue(error);

      const promise = service.calculateRoute(request);

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(promise).rejects.toThrow('Failed to calculate route.');
      expect(console.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error,
          detail: 'An error occurred while calculating the route.',
          calculateRouteCommandInput: expect.objectContaining({
            CalculatorName: 'my-calculator',
          }),
        }),
      );
    });
  });

  describe('geocodeAddress', () => {
    it('sends a SearchPlaceIndexForTextCommand with a default of 20 results', async () => {
      mockSend.mockResolvedValue({ Results: [] });

      await expect(service.geocodeAddress('1 Main St')).resolves.toEqual([]);

      const command = mockSend.mock.calls[0][0];
      expect(command).toBeInstanceOf(SearchPlaceIndexForTextCommand);
      expect(command.input).toEqual({
        IndexName: 'my-index',
        Text: '1 Main St',
        MaxResults: 20,
      });
    });

    it('passes a custom maxResults', async () => {
      mockSend.mockResolvedValue({ Results: [] });

      await service.geocodeAddress('1 Main St', 3);

      expect(mockSend.mock.calls[0][0].input.MaxResults).toBe(3);
    });

    it('maps place results to geocoding DTOs', async () => {
      mockSend.mockResolvedValue({
        Results: [
          {
            Relevance: 0.97,
            Place: {
              Label: '1 Main St, Springfield, IL 62701, USA',
              Geometry: { Point: [-89.65, 39.8] },
              Country: 'USA',
              Region: 'Illinois',
              Municipality: 'Springfield',
              Street: 'Main St',
              PostalCode: '62701',
            },
          },
        ],
      });

      await expect(service.geocodeAddress('1 Main St')).resolves.toEqual([
        {
          text: '1 Main St, Springfield, IL 62701, USA',
          relevance: 0.97,
          coordinates: { longitude: -89.65, latitude: 39.8 },
          country: 'USA',
          region: 'Illinois',
          municipality: 'Springfield',
          street: 'Main St',
          postalCode: '62701',
        },
      ]);
    });

    it('fills defaults for sparse results and drops empty entries', async () => {
      mockSend.mockResolvedValue({
        Results: [null, {}, { Place: { Geometry: {} } }, undefined],
      });

      const sparse = {
        text: '',
        relevance: 0,
        coordinates: { longitude: undefined, latitude: undefined },
        country: undefined,
        region: undefined,
        municipality: undefined,
        street: undefined,
        postalCode: undefined,
      };
      await expect(service.geocodeAddress('nowhere')).resolves.toEqual([
        sparse,
        sparse,
      ]);
    });

    it.each([
      ['no Results', {}],
      ['an undefined Results', { Results: undefined }],
    ])('returns an empty array for %s', async (_label, response) => {
      mockSend.mockResolvedValue(response);

      await expect(service.geocodeAddress('x')).resolves.toEqual([]);
    });

    it('throws BadRequestException when the client fails', async () => {
      const error = new Error('ValidationException');
      mockSend.mockRejectedValue(error);

      const promise = service.geocodeAddress('1 Main St');

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(promise).rejects.toThrow('Failed to geocode address.');
      expect(console.error).toHaveBeenCalledWith({
        error,
        detail: 'An error occurred while geocoding the address.',
        address: '1 Main St',
      });
    });

    it('throws BadRequestException when the response is undefined', async () => {
      mockSend.mockResolvedValue(undefined);

      await expect(service.geocodeAddress('1 Main St')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
