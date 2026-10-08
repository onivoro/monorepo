import { Injectable } from '@nestjs/common';
import { ServerAwsCognitoConfig } from '../server-aws-cognito-config.class';

@Injectable()
export class CognitoRefreshTokenService {
  constructor(private config: ServerAwsCognitoConfig) {}

  async getRefreshToken(REFRESH_TOKEN: string) {
    const body = JSON.stringify({
      ClientId: this.config.COGNITO_USER_POOL_CLIENT_ID,
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      AuthParameters: {
        REFRESH_TOKEN,
      },
    });

    const response = await fetch(
      `https://cognito-idp.${this.config.AWS_REGION}.amazonaws.com`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
        },
        body,
      },
    );

    if (!response.ok) {
      console.error('Failed to fetch refresh token');

      return;
    }

    const responseBody = (await response.json()) as any;

    return responseBody?.AuthenticationResult;
  }
}
