import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { DynamicModule, Module } from '@nestjs/common';
import { moduleFactory } from '@onivoro/server-common';
import { ServerAwsCognitoConfig } from './server-aws-cognito-config.class';
import { CognitoTokenValidatorService } from './services/cognito-token-validator.service';
import { CognitoRefreshTokenService } from './services/cognito-refresh-token.service';
import { CognitoUserService } from './services/cognito-user.service';
import { AwsCredentials, ServerAwsCredentialProvidersModule } from '@onivoro/server-aws-credential-providers';

let cognitoIdentityProviderClient: CognitoIdentityProviderClient | null = null;

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
        {
          provide: CognitoIdentityProviderClient,
          useFactory: (credentials: AwsCredentials) =>
            cognitoIdentityProviderClient ||
            (cognitoIdentityProviderClient = new CognitoIdentityProviderClient({
              region: config.AWS_REGION,
              apiVersion: config.COGNITO_API_VERSION,
              credentials
            })),
          inject: [AwsCredentials],
        },
        CognitoTokenValidatorService,
        CognitoRefreshTokenService,
        CognitoUserService,
      ],
      module: ServerAwsCognitoModule,
    });
  }
}
