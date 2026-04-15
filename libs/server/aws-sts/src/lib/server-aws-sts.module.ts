import { Module } from '@nestjs/common';
import { moduleFactory } from '@onivoro/server-common';
import { STSClient } from '@aws-sdk/client-sts';
import { StsService } from './services/sts.service';
import { ServerAwsStsConfig } from './classes/server-aws-sts-config.class';
import { awsClientProvider, ServerAwsCredentialProvidersModule } from '@onivoro/server-aws-credential-providers';

@Module({})
export class ServerAwsStsModule {
  static configure(config: ServerAwsStsConfig) {
    return moduleFactory({
      module: ServerAwsStsModule,
      imports: [ServerAwsCredentialProvidersModule.configure(config)],
      providers: [
        awsClientProvider(STSClient, config),
        { provide: ServerAwsStsConfig, useValue: config },
        StsService
      ]
    })
  }
}
