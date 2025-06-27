import { Module } from '@nestjs/common';
import { moduleFactory } from '@onivoro/server/common';
import { IAMClient } from '@aws-sdk/client-iam';
import { IamService } from './services/iam.service';
import { ServerAwsIamConfig } from './classes/server-aws-iam-config.class';
import { AwsCredentials, ServerAwsCredentialProvidersModule } from '@onivoro/server/aws-credential-providers';

let iamClient: IAMClient | null = null;

@Module({
})
export class ServerAwsIamModule {
  static configure(config: ServerAwsIamConfig) {
    return moduleFactory({
      module: ServerAwsIamModule,
      imports: [ServerAwsCredentialProvidersModule.configure(config)],
      providers: [
        {
          provide: IAMClient,
          useFactory: (credentials: AwsCredentials) => iamClient
            ? iamClient
            : iamClient = new IAMClient({
              region: config.AWS_REGION,
              logger: console,
              credentials
            }),
          inject: [AwsCredentials]
        },
        { provide: ServerAwsIamConfig, useValue: config },
        IamService
      ],
    })
  }
}
