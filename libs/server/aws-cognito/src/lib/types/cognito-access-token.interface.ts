export interface ICognitoAccessToken {
    sub: string;
    iss: string;
    client_id: string;
    origin_jti: string;
    event_id: string;
    token_use: "access";
    scope: string;
    auth_time: number;
    exp: number;
    iat: number;
    jti: string;
    username: string;
    'cognito:username': string;
}
