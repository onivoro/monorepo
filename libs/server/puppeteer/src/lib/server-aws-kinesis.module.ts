import { Module } from '@nestjs/common';
import { moduleFactory } from '@onivoro/server-common';
import { KinesisClient } from '@aws-sdk/client-kinesis';
import { KinesisService } from './services/kinesis.service';
import { ServerAwsKinesisConfig } from './classes/server-aws-kinesis-config.class';
import { AwsCredentials, ServerAwsCredentialProvidersModule } from '@onivoro/server-aws-credential-providers';

let kinesisClient: KinesisClient | null = null;

@Module({})
export class ServerAwsKinesisModule {
  static configure(config: ServerAwsKinesisConfig) {
    return moduleFactory({
      module: ServerAwsKinesisModule,
      imports: [ServerAwsCredentialProvidersModule.configure(config)],
      providers: [
        {
          provide: KinesisClient,
          useFactory: (credentials: AwsCredentials) => kinesisClient
            ? kinesisClient
            : kinesisClient = new KinesisClient({
              region: config.AWS_REGION,
              logger: console,
              credentials
            }),
          inject: [AwsCredentials]
        },
        { provide: ServerAwsKinesisConfig, useValue: config },
        KinesisService
      ]
    });
  }
}
