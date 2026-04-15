import { Module } from '@nestjs/common';
import { moduleFactory } from '@onivoro/server-common';
import { SNSClient } from '@aws-sdk/client-sns';
import { ServerAwsSnsConfig } from './classes/server-aws-sns-config.class';
import { awsClientProvider, ServerAwsCredentialProvidersModule } from '@onivoro/server-aws-credential-providers';

@Module({
})
export class ServerAwsSnsModule {
  static configure(config: ServerAwsSnsConfig) {
    return moduleFactory({
      module: ServerAwsSnsModule,
      imports: [ServerAwsCredentialProvidersModule.configure(config)],
      providers: [
        awsClientProvider(SNSClient, config),
        { provide: ServerAwsSnsConfig, useValue: config },
      ],
    })
  }
}
