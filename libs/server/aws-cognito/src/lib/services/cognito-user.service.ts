import { Injectable } from "@nestjs/common";
import { ServerAwsCognitoConfig } from "../server-aws-cognito-config.class";
import { CognitoIdentityProviderClient, GetUserCommand } from "@aws-sdk/client-cognito-identity-provider";

@Injectable()
export class CognitoUserService {

    async getUser(_token?: string | undefined) {
        if (!_token) {
            return;
        }

        try {
            const AccessToken = _token?.replace('Bearer ', '');

            const command = new GetUserCommand({
                AccessToken,
            });

            const response = await this.client.send(command);
            console.log("Token is valid. User attributes:", response);
            return response;
        } catch (error: any) {
            console.error({ detail: 'Token validation failed', error });
            return;
        }
    }

    constructor(private config: ServerAwsCognitoConfig, private client: CognitoIdentityProviderClient) { }
}
