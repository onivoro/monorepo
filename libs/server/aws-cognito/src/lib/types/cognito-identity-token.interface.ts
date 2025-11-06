// deprecated... use the ICognitoIdToken instead

export interface ICognitoIdentityToken {
  at_hash: string;
  sub: string;
  "cognito:groups": string[];
  email_verified: boolean;
  iss: string;
  "cognito:username": string;
  nonce: string;
  origin_jti: string;
  aud: string;
  identities: Array<{
    dateCreated: string;
    userId: string;
    providerName: string;
    providerType: string;
    issuer: string | null;
    primary: string;
  }>;
  token_use: string;
  auth_time: number;
  exp: number;
  iat: number;
  jti: string;
  email: string;
}