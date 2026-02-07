import { Module } from '@nestjs/common';
import { FirehoseClient } from '@aws-sdk/client-firehose';
import { moduleFactory } from '@onivoro/server-common';
import { ServerAwsFirehoseConfig } from './server-aws-firehose-config.class';
import { AwsCredentials, ServerAwsCredentialProvidersModule } from '@onivoro/server-aws-credential-providers';
import { FirehoseService } from './services/firehose.service';

let firehoseClient: FirehoseClient | null = null;

@Module({})
export class ServerAwsFirehoseModule {
  static configure(config: ServerAwsFirehoseConfig) {
    return moduleFactory({
      imports: [ServerAwsCredentialProvidersModule.configure(config)],
      module: ServerAwsFirehoseModule,
      providers: [
        FirehoseService,
        { provide: ServerAwsFirehoseConfig, useValue: config },
        {
          provide: FirehoseClient,
          useFactory: (credentials: AwsCredentials) =>
            firehoseClient ||
            (firehoseClient = new FirehoseClient({
              region: config.AWS_REGION,
              credentials
            })),
          inject: [AwsCredentials]
        },
      ]
    });
  }
}