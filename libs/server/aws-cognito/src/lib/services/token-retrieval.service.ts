import { Injectable } from "@nestjs/common";
import axios from 'axios';
import { ServerAwsCognitoSamlConfig } from "../server-aws-cognito-saml-config.class";

@Injectable()
export class TokenRetrievalService {

    async exchangeCodeForTokens(code: string) {
        try {
            const response = await axios.post(this.config.COGNITO_TOKEN_ENDPOINT, new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: this.config.COGNITO_USER_POOL_CLIENT_ID,
                code: code,
                redirect_uri: this.config.COGNITO_REDIRECT_URI
            }), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            console.log({ responseData: response?.data, detail: 'TokenRetrievalService.exchangeCodeForTokens' });

            const { id_token, access_token, refresh_token } = response.data;

            console.log({ id_token, access_token, refresh_token });

            return { idToken: id_token, accessToken: access_token, refreshToken: refresh_token };
        } catch (error) {
            console.error({ error });
        }
    }

    constructor(private config: ServerAwsCognitoSamlConfig) { }
}