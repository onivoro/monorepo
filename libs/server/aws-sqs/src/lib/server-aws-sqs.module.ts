import { Module } from '@nestjs/common';
import { moduleFactory } from '@onivoro/server-common';
import { SQSClient } from '@aws-sdk/client-sqs';
import { SqsService } from './services/sqs.service';
import { SqsConsumerFactoryService } from './services/sqs-consumer-factory.service';
import { ServerAwsSqsConfig } from './classes/server-aws-sqs-config.class';
import { awsClientProvider, ServerAwsCredentialProvidersModule } from '@onivoro/server-aws-credential-providers';

@Module({
})
export class ServerAwsSqsModule {
  static configure(config: ServerAwsSqsConfig) {
    return moduleFactory({
      module: ServerAwsSqsModule,
      imports: [ServerAwsCredentialProvidersModule.configure(config)],
      providers: [
        awsClientProvider(SQSClient, config),
        { provide: ServerAwsSqsConfig, useValue: config },
        SqsService,
        SqsConsumerFactoryService
      ],
    })
  }
}
