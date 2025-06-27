import { Module } from '@nestjs/common';
import { ServerAwsCredentialProvidersConfig } from './server-aws-credential-providers-config.class';
import { resolveAwsCredentialProvidersByProfile } from './resolve-aws-credential-providers-by-profile.function';
import { AwsCredentials } from './aws-credentials.class';

@Module({})
export class ServerAwsCredentialProvidersModule {
  static configure(config: ServerAwsCredentialProvidersConfig) {
    return {
      module: ServerAwsCredentialProvidersModule,
      providers: [
        { provide: ServerAwsCredentialProvidersConfig, useValue: config },
        {
          provide: AwsCredentials,
          useFactory: async () => await resolveAwsCredentialProvidersByProfile(config.AWS_PROFILE),
        },
      ],
      exports: [AwsCredentials, ServerAwsCredentialProvidersConfig],
    };
  }
}