import { Module } from '@nestjs/common';
import { moduleFactory } from '@onivoro/server-common';
import { RedshiftDataClient, RedshiftDataClientConfig } from '@aws-sdk/client-redshift-data';
import { RedshiftDataService } from './services/redshift.service';
import { ServerAwsRedshiftDataConfig } from './classes/server-aws-redshift-config.class';
import { RedshiftServerlessClient } from '@aws-sdk/client-redshift-serverless';
import { RedshiftClient } from '@aws-sdk/client-redshift';
import { AwsCredentials, ServerAwsCredentialProvidersModule } from '@onivoro/server-aws-credential-providers';

let redshiftClient: RedshiftClient | null = null;
let redshiftDataClient: RedshiftDataClient | null = null;
let redshiftServerlessClient: RedshiftServerlessClient | null = null;


@Module({})
export class ServerAwsRedshiftDataModule {
  static configure(config: ServerAwsRedshiftDataConfig) {
    return moduleFactory({
      module: ServerAwsRedshiftDataModule,
      imports: [ServerAwsCredentialProvidersModule.configure(config)],
      providers: [
        {
          provide: RedshiftDataClient,
          useFactory: (credentials: AwsCredentials) => redshiftDataClient
            ? redshiftDataClient
            : redshiftDataClient = new RedshiftDataClient(from(config, credentials)),
          inject: [AwsCredentials]
        },
        {
          provide: RedshiftServerlessClient,
          useFactory: (credentials: AwsCredentials) => redshiftServerlessClient
            ? redshiftServerlessClient
            : redshiftServerlessClient = new RedshiftServerlessClient(from(config, credentials)),
          inject: [AwsCredentials]
        },
        {
          provide: RedshiftClient,
          useFactory: (credentials: AwsCredentials) => redshiftClient
            ? redshiftClient
            : redshiftClient = new RedshiftClient(from(config, credentials)),
          inject: [AwsCredentials]
        },
        { provide: ServerAwsRedshiftDataConfig, useValue: config },
        RedshiftDataService
      ]
    })
  }
}

function from(config: ServerAwsRedshiftDataConfig, credentials: AwsCredentials): RedshiftDataClientConfig {
  return {
    region: config.AWS_REGION,
    logger: console,
    credentials
  };
}
