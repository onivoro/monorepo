import { Module } from '@nestjs/common';
import { moduleFactory } from '@onivoro/server/common';
import { ServerAwsCognitoSamlConfig } from './server-aws-cognito-saml-config.class';
import { TokenRetrievalService } from './services/token-retrieval.service';
import { TokenRetrievalController } from './controllers/token-retrieval.controller';
import { JwksClient } from 'jwks-rsa';
import { TokenValidationService } from './services/token-validation.service';
import { TokenValidationController } from './controllers/token-validation.controller';
import { SamlConfigController } from './controllers/saml-config.controller';

@Module({})
export class ServerAwsCognitoSamlModule {
//https://www.youtube.com/watch?v=X0y9ZNs_sdU
  static configure(config: ServerAwsCognitoSamlConfig) {
    return moduleFactory({
      module: ServerAwsCognitoSamlModule,
      imports: [],
      providers: [
        {
          provide: JwksClient,
          useValue: new JwksClient({
            jwksUri: `https://cognito-idp.us-east-2.amazonaws.com/${config.COGNITO_USER_POOL_ID}/.well-known/jwks.json`,
            cache: true, // Cache keys to reduce requests
            rateLimit: true, // Limit requests to JWKS endpoint
            jwksRequestsPerMinute: 10
          })
        },
        TokenRetrievalService,
        TokenValidationService,
        { provide: ServerAwsCognitoSamlConfig, useValue: config }
      ],
      controllers: [
        SamlConfigController,
        TokenRetrievalController,
        TokenValidationController,
      ],
    })
  }
}
