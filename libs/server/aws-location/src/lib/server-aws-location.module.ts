import { Module } from '@nestjs/common';
import { LocationService } from './services/location.service';
import { LocationClient } from '@aws-sdk/client-location';
import { ServerAwsLocationConfig } from './server-aws-location-config.class';
import { AwsCredentials, ServerAwsCredentialProvidersModule } from '@onivoro/server-aws-credential-providers';
import { moduleFactory } from '@onivoro/server-common';

let locationClient: LocationClient | null = null;

@Module({})
export class ServerAwsLocationModule {
  static configure(config: ServerAwsLocationConfig) {
    return moduleFactory({
      module: ServerAwsLocationModule,
      imports: [
        ServerAwsCredentialProvidersModule.configure(config)
      ],
      providers: [
        { provide: ServerAwsLocationConfig, useValue: config },
        LocationService,
        {
          provide: LocationClient,
          useFactory: (credentials: AwsCredentials) =>
            locationClient ||
            (locationClient = new LocationClient({
              region: config.AWS_REGION,
              credentials
            })),
          inject: [AwsCredentials]
        },
      ]
    });
  }
}