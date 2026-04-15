import { Module } from '@nestjs/common';
import { moduleFactory } from '@onivoro/server-common';
import { KinesisClient } from '@aws-sdk/client-kinesis';
import { KinesisService } from './services/kinesis.service';
import { ServerAwsKinesisConfig } from './classes/server-aws-kinesis-config.class';
import { awsClientProvider, ServerAwsCredentialProvidersModule } from '@onivoro/server-aws-credential-providers';

@Module({})
export class ServerAwsKinesisModule {
  static configure(config: ServerAwsKinesisConfig) {
    return moduleFactory({
      module: ServerAwsKinesisModule,
      imports: [ServerAwsCredentialProvidersModule.configure(config)],
      providers: [
        awsClientProvider(KinesisClient, config),
        { provide: ServerAwsKinesisConfig, useValue: config },
        KinesisService
      ]
    });
  }
}
