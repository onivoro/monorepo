import { DynamicModule, Module } from '@nestjs/common';
import { moduleFactory } from '@onivoro/server-common';
import { ServerAwsLambdaConfig } from './classes/server-aws-lambda-config.class';
import { Lambda, LambdaClient } from '@aws-sdk/client-lambda';
import { LambdaService } from './services/lambda.service';
import { AwsCredentials, ServerAwsCredentialProvidersModule } from '@onivoro/server-aws-credential-providers';

let lambdaClient: LambdaClient | null = null;

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
        {
          provide: LambdaClient,
          useFactory: (credentials: AwsCredentials) => lambdaClient
            ? lambdaClient
            : lambdaClient = new LambdaClient({
              region: config.AWS_REGION,
              logger: console,
              credentials
            }),
          inject: [AwsCredentials]
        },
      ]
    });
  }
}
