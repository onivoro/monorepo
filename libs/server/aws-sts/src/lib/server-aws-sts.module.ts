import { Module } from '@nestjs/common';
import { moduleFactory } from '@onivoro/server-common';
import { STSClient } from '@aws-sdk/client-sts';
import { StsService } from './services/sts.service';
import { ServerAwsStsConfig } from './classes/server-aws-sts-config.class';
import { AwsCredentials, ServerAwsCredentialProvidersModule } from '@onivoro/server-aws-credential-providers';

let stsClient: STSClient | null = null;

@Module({})
export class ServerAwsStsModule {
  static configure(config: ServerAwsStsConfig) {
    return moduleFactory({
      module: ServerAwsStsModule,
      imports: [ServerAwsCredentialProvidersModule.configure(config)],
      providers: [
        {
          provide: STSClient,
          useFactory: (credentials: AwsCredentials) => stsClient
            ? stsClient
            : stsClient = new STSClient({
              region: config.AWS_REGION,
              logger: console,
              credentials
            }),
          inject: [AwsCredentials]
        },
        { provide: ServerAwsStsConfig, useValue: config },
        StsService
      ]
    })
  }
}
