import { DynamicModule, Module } from '@nestjs/common';
import { moduleFactory } from '@onivoro/server-common';
import { ServerAwsLambdaConfig } from './classes/server-aws-lambda-config.class';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { LambdaService } from './services/lambda.service';
import { awsClientProvider, ServerAwsCredentialProvidersModule } from '@onivoro/server-aws-credential-providers';

@Module({})
export class ServerAwsLambdaModule {
  static configure(config: ServerAwsLambdaConfig): DynamicModule {
    return moduleFactory({
      module: ServerAwsLambdaModule,
      imports: [ServerAwsCredentialProvidersModule.configure(config)],
      providers: [
        LambdaService,
        {
          provide: ServerAwsLambdaConfig,
          useValue: config
        },
        awsClientProvider(LambdaClient, config),
      ]
    });
  }
}
