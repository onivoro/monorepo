import { Module } from '@nestjs/common';
import { moduleFactory } from '@onivoro/server-common';
import { SQSClient } from '@aws-sdk/client-sqs';
import { SqsService } from './services/sqs.service';
import { SqsConsumerFactoryService } from './services/sqs-consumer-factory.service';
import { ServerAwsSqsConfig } from './classes/server-aws-sqs-config.class';
import { AwsCredentials, ServerAwsCredentialProvidersModule } from '@onivoro/server-aws-credential-providers';

let sqsClient: SQSClient | null = null;

@Module({
})
export class ServerAwsSqsModule {
  static configure(config: ServerAwsSqsConfig) {
    return moduleFactory({
      module: ServerAwsSqsModule,
      imports: [ServerAwsCredentialProvidersModule.configure(config)],
      providers: [
        {
          provide: SQSClient,
          useFactory: (credentials: AwsCredentials) => sqsClient
            ? sqsClient
            : sqsClient = new SQSClient({
              region: config.AWS_REGION,
              credentials
            }),
            inject: [AwsCredentials]
        },
        { provide: ServerAwsSqsConfig, useValue: config },
        SqsService,
        SqsConsumerFactoryService
      ],
    })
  }
}
