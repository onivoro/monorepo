import { Injectable } from "@nestjs/common";
import { CognitoTokenValidatorService } from "../services/cognito-token-validator.service";
import { Request, Response, NextFunction } from 'express';
import { UserHydraterService } from "../services/user-hydrater.service";
import { idTokenKey } from "../constants/id-token-key.constant";
import { requestUserKey } from "../constants/request-user-key.constant";
import { ServerAwsCognitoOidcConfig } from "../server-aws-cognito-oidc-config.class";
import { getTokenSigningUrl } from "../functions/get-token-signing-url.function";
import { CookieService } from "../services/cookie.service";
import { TokensDto } from "../dtos/tokens.dto";

@Injectable()
export class OidcIdTokenMiddleware {
    static idTokenKey = idTokenKey;

    constructor(
        private cognitoTokenValidatorService: CognitoTokenValidatorService,
        private config: ServerAwsCognitoOidcConfig,
        private userHydraterService: UserHydraterService,
        private cookieService: CookieService,
    ) { }

    async use(req: Request, res: Response, next: NextFunction) {
        const logContext = {
            method: req.method,
            url: req.url,
            userAgent: req.headers['user-agent'],
            ip: req.ip,
        };

        if (req.url.includes('/api/') && req.url !== '/api/health') {

            await this.authorizeAndHydrateUser(req, res);
        }

        next();
    }

    async authorizeAndHydrateUser(req: Request, res: Response<any, Record<string, any>>) {
        const logContext = {
            method: req.method,
            url: req.url,
        };

        try {
            const id_token = this.get(req, 'id_token');

            (req as any)[idTokenKey] = id_token ? await this.cognitoTokenValidatorService.validate(id_token) : undefined;
        } catch (error: any) {
            console.error('Error during token validation', {
                ...logContext,
                error: error.message,
                errorName: error.name,
                stack: error.stack,
            });

            if (error?.name === 'TokenExpiredError') {
                console.log('Token expired, attempting to refresh using refresh token', {
                    ...logContext,
                    tokenExpired: true,
                });

                try {
                    const refreshToken = this.get(req, 'refresh_token');

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

                            const tokens: TokensDto = (await response.json() as any);

                            if (tokens.id_token) {

                                (req as any)[idTokenKey] = await this.cognitoTokenValidatorService.validate(tokens.id_token);

                                if ((req as any)[idTokenKey]) {

                                    this.setCookies(res, tokens);
                                } else {
                                    console.error('New validation failed after refresh', {
                                        ...logContext,
                                        newTokenValid: false,
                                    });
                                }
                            } else {
                                console.error('Token refresh response missing ID token', {
                                    ...logContext,
                                    tokensReceived: Object.keys(tokens),
                                });
                            }
                        } else {
                            const errorBody = await response.text();
                            console.error('Token refresh request failed', {
                                ...logContext,
                                statusCode: response.status,
                                statusText: response.statusText,
                                errorBody,
                                refreshSuccessful: false,
                            });

                            (req as any)[requestUserKey] = undefined;
                            (req as any)[idTokenKey] = undefined;
                        }
                    } else {
                        console.warn('Token expired but no refresh token available', {
                            ...logContext,
                            hasRefreshToken: false,
                        });
                    }
                } catch (refreshError: any) {
                    console.error('Error during token refresh process', {
                        ...logContext,
                        refreshError: refreshError.message,
                        refreshErrorStack: refreshError.stack,
                    });
                }
            }
        }

        if ((req as any)[idTokenKey]) {
            const email = (req as any)[idTokenKey]?.email;

            try {
                (req as any)[requestUserKey] = await this.userHydraterService.hydrateUserByEmail(email);

            } catch (error: any) {
                console.error('Failed to hydrate user by email', {
                    ...logContext,
                    email,
                    error: error.message,
                    errorStack: error.stack,
                    userHydrated: false,
                });
            }
        }
    }

    setCookies(res: Response<any, Record<string, any>>, tokens: TokensDto) {
        this.cookieService.setCookies(res, tokens);
    }

    get(req: Request, key: 'id_token' | 'refresh_token') {
        return this.cookieService.get(req, key);
    }
}
