import jwt from 'jsonwebtoken';
import { Injectable } from "@nestjs/common";
import { JwksClient } from 'jwks-rsa';
import { ServerAwsCognitoOidcConfig } from '../server-aws-cognito-oidc-config.class';

@Injectable()
export class TokenValidationService {

    async getSigningKey(token: string) {
        const decoded = jwt.decode(token, { complete: true });
        if (!decoded || !decoded.header.kid) {
            throw new Error('Invalid token: No kid found');
        }

        const key = await this.jwksClient.getSigningKey(decoded.header.kid);
        return key.getPublicKey();
    }

    async validateIdentityToken(token: string): Promise<TIdentityToken> {
        try {
            const publicKey = await this.getSigningKey(token);

            const decoded = jwt.verify(token, publicKey, {
                issuer: `https://cognito-idp.us-east-2.amazonaws.com/${this.config.COGNITO_USER_POOL_ID}`,
                audience: this.config.COGNITO_USER_POOL_CLIENT_ID,
                algorithms: ['RS256']
            });

            return decoded as any;
        } catch (err: any) {
            throw new Error(`Token validation failed: ${err.message}`);
        }
    }

    constructor(private config: ServerAwsCognitoOidcConfig, private jwksClient: JwksClient) { }
}

type TIdentityToken = {
    at_hash: 'D_yilMUv8xzdL9zBZ1Uvrg',
    sub: 'f19bc550-4031-7090-9a43-0c42c81a487a',
    'cognito:groups': ['us-east-2_smGj6f5FP_MicrosoftEntra'],
    email_verified: false,
    iss: 'https://cognito-idp.us-east-2.amazonaws.com/us-east-2_smGj6f5FP',
    'cognito:username': 'MicrosoftEntra_lee.e.norris_hotmail.com#EXT#@leeenorrishotmail932.onmicrosoft.com',
    nonce: 'z7prm9_rNN9uLESHHuzz0-asHUeUeGemNBd8lYEafmfU5kJ3EVXgq8VV4OwR-t0nkXUb0Tb7RnEn1mBfAhOCmzsGthi7ySQ2XYdkWbJZ67tzXaJHIE0Rja9-xnhuCtRL4R_mWnJgeEZ8fpPWcVMH_Co34HqON-ETAdgDRql7lRA',
    origin_jti: '99902af5-a896-4619-9665-ae24e6321417',
    aud: '5mbrbido0d5q0ncotbubcos4vc',
    identities: [{
        "dateCreated": "1740978122439",
        "userId": "lee.e.norris_hotmail.com#EXT#@leeenorrishotmail932.onmicrosoft.com",
        "providerName": "MicrosoftEntra",
        "providerType": "SAML",
        "issuer": "https://sts.windows.net/43a1e77d-f1ff-4df6-b404-e6b85a8d8511/",
        "primary": "true"
      }],
    token_use: 'id',
    auth_time: 1740987552,
    name: 'lee.e.norris_hotmail.com#EXT#@leeenorrishotmail932.onmicrosoft.com',
    exp: 1740991152,
    iat: 1740987552,
    jti: '55488077-bb14-4d14-aa2c-7d8807e46c55',
    email: 'lee.e.norris@hotmail.com'
};