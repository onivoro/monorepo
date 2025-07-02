import { Module } from '@nestjs/common';
import { moduleFactory } from '@onivoro/server-common';
import { SNSClient } from '@aws-sdk/client-sns';
import { ServerAwsSnsConfig } from './classes/server-aws-sns-config.class';
import { AwsCredentials, ServerAwsCredentialProvidersModule } from '@onivoro/server-aws-credential-providers';

let snsClient: SNSClient | null = null;

@Module({
})
export class ServerAwsSnsModule {
  static configure(config: ServerAwsSnsConfig) {
    return moduleFactory({
      module: ServerAwsSnsModule,
      imports: [ServerAwsCredentialProvidersModule.configure(config)],
      providers: [
        {
          provide: SNSClient,
          useFactory: (credentials: AwsCredentials) => snsClient
            ? snsClient
            : snsClient = new SNSClient({
              region: config.AWS_REGION,
              logger: console,
              credentials
            }),
            inject: [AwsCredentials]
        },
        { provide: ServerAwsSnsConfig, useValue: config },
      ],
    })
  }
}
