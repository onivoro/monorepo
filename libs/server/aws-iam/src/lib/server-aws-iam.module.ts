import { Module } from '@nestjs/common';
import { moduleFactory } from '@onivoro/server-common';
import { IAMClient } from '@aws-sdk/client-iam';
import { IamService } from './services/iam.service';
import { ServerAwsIamConfig } from './classes/server-aws-iam-config.class';
import { awsClientProvider, ServerAwsCredentialProvidersModule } from '@onivoro/server-aws-credential-providers';

@Module({
})
export class ServerAwsIamModule {
  static configure(config: ServerAwsIamConfig) {
    return moduleFactory({
      module: ServerAwsIamModule,
      imports: [ServerAwsCredentialProvidersModule.configure(config)],
      providers: [
        awsClientProvider(IAMClient, config),
        { provide: ServerAwsIamConfig, useValue: config },
        IamService
      ],
    })
  }
}
