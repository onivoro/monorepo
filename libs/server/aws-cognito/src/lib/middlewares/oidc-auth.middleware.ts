import { Injectable } from "@nestjs/common";
import { CognitoTokenValidatorService } from "../services/cognito-token-validator.service";
import { Request, Response, NextFunction } from 'express';
import { UserHydraterService } from "../services/user-hydrater.service";
import { idTokenKey } from "../constants/id-token-key.constant";
import { requestUserKey } from "../constants/request-user-key.constant";
import { ServerAwsCognitoOidcConfig } from "../server-aws-cognito-oidc-config.class";
import { getTokenSigningUrl } from "../functions/get-token-signing-url.function";
import { CookieService } from "../services/cookie.service";

@Injectable()
export class OidcAuthMiddleware {
    static idTokenKey = idTokenKey;
    constructor(
        private cognitoTokenValidatorService: CognitoTokenValidatorService,
        private config: ServerAwsCognitoOidcConfig,
        private userHydraterService: UserHydraterService,
        private cookieService: CookieService,
    ) { }

    async use(req: Request, res: Response, next: NextFunction) {

        if (req.url.includes('/api/') && req.url !== '/api/health') {
            await this.authorizeAndHydrateUser(req, res);
        }

        next();
    }

    async authorizeAndHydrateUser(req: Request, res: Response<any, Record<string, any>>) {
        try {
            const id_token = this.cookieService.get(req, 'id_token');

            (req as any)[idTokenKey] = id_token ? await this.cognitoTokenValidatorService.validate(id_token) : undefined;
        } catch (error: any) {
            if (error?.name === 'TokenExpiredError') {
                try {
                    const refreshToken = this.cookieService.get(req, 'refresh_token');
                    if (refreshToken) {
                        const endpoint = getTokenSigningUrl(this.config);
                        const clientId = this.config.COGNITO_USER_POOL_CLIENT_ID;
                        const bodyParams = new URLSearchParams({
                            grant_type: 'refresh_token',
                            client_id: clientId,
                            refresh_token: refreshToken,
                        });
                        const response = await fetch(endpoint, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                            },
                            body: bodyParams.toString()
                        });

                        if (response.ok) {
                            const tokens: { id_token: string | undefined; refresh_token: string | undefined; access_token: string | undefined; } = (await response.json() as any);

                            if (tokens.id_token) {
                                (req as any)[idTokenKey] = await this.cognitoTokenValidatorService.validate(tokens.id_token);

                                if ((req as any)[idTokenKey]) {
                                    this.cookieService.setCookies(res, tokens);
                                }
                            }
                        } else {
                            const errorBody = await response.text();
                            console.error('Failed to refresh Cognito token', response, errorBody);
                            (req as any)[requestUserKey] = undefined;
                            (req as any)[idTokenKey] = undefined;
                        }
                    }
                } catch (refreshError) {
                    console.error('Error refreshing Cognito token', refreshError);
                }
            } else {
                console.error('Error validating Cognito token', error);
            }
        }

        if ((req as any)[idTokenKey]) {
            const email = (req as any)[idTokenKey]?.email;

            try {
                (req as any)[requestUserKey] = await this.userHydraterService.hydrateUserByEmail(email);
            } catch (error) {
                console.error(`failed to hydrate user by email "${email}"`);
            }
        }
    }
}
