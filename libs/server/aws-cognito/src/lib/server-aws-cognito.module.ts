import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { DynamicModule, Module } from '@nestjs/common';
import { moduleFactory } from '@onivoro/server-common';
import { ServerAwsCognitoConfig } from './server-aws-cognito-config.class';
import { CognitoTokenValidatorService } from './services/cognito-token-validator.service';
import { CognitoRefreshTokenService } from './services/cognito-refresh-token.service';
import { CognitoUserService } from './services/cognito-user.service';
import { awsClientProvider, ServerAwsCredentialProvidersModule } from '@onivoro/server-aws-credential-providers';

@Module({})
export class ServerAwsCognitoModule {
  static configure(config: ServerAwsCognitoConfig): DynamicModule {
    return moduleFactory({
      imports: [ServerAwsCredentialProvidersModule.configure(config)],
      providers: [
        {
          provide: ServerAwsCognitoConfig,
          useValue: config,
        },
        awsClientProvider(CognitoIdentityProviderClient, config, { apiVersion: config.COGNITO_API_VERSION }),
        CognitoTokenValidatorService,
        CognitoRefreshTokenService,
        CognitoUserService,
      ],
      module: ServerAwsCognitoModule,
    });
  }
}
