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
        const startTime = Date.now();
        const logContext = {
            method: req.method,
            url: req.url,
            userAgent: req.headers['user-agent'],
            ip: req.ip,
        };

        console.debug('Processing request in OIDC auth middleware', logContext);

        if (req.url.includes('/api/') && req.url !== '/api/health') {
            console.log('Request requires authentication, processing OIDC authorization', {
                ...logContext,
                requiresAuth: true,
            });

            await this.authorizeAndHydrateUser(req, res);

            const processingTime = Date.now() - startTime;
            console.debug('OIDC authorization processing completed', {
                ...logContext,
                processingTime,
                hasValidToken: !!(req as any)[idTokenKey],
                hasUser: !!(req as any)[requestUserKey],
            });
        } else {
            console.debug('Request does not require authentication, skipping OIDC processing', {
                ...logContext,
                requiresAuth: false,
            });
        }

        next();
    }

    async authorizeAndHydrateUser(req: Request, res: Response<any, Record<string, any>>) {
        const logContext = {
            method: req.method,
            url: req.url,
        };

        console.debug('Starting user authorization and hydration process', logContext);

        try {
            const id_token = this.cookieService.get(req, 'id_token');

            if (id_token) {
                console.debug('ID token found in cookies, validating token', {
                    ...logContext,
                    tokenLength: id_token.length,
                    tokenPrefix: id_token.substring(0, 20) + '...',
                });
            } else {
                console.debug('No ID token found in cookies', logContext);
            }

            (req as any)[idTokenKey] = id_token ? await this.cognitoTokenValidatorService.validate(id_token) : undefined;

            if ((req as any)[idTokenKey]) {
                console.log('ID token validated successfully', {
                    ...logContext,
                    tokenValid: true,
                    email: (req as any)[idTokenKey]?.email,
                    sub: (req as any)[idTokenKey]?.sub,
                    exp: (req as any)[idTokenKey]?.exp,
                });
            } else if (id_token) {
                console.warn('ID token validation failed', {
                    ...logContext,
                    tokenValid: false,
                });
            }

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
                    const refreshToken = this.cookieService.get(req, 'refresh_token');

                    if (refreshToken) {
                        console.debug('Refresh token found, initiating token refresh', {
                            ...logContext,
                            refreshTokenLength: refreshToken.length,
                            refreshTokenPrefix: refreshToken.substring(0, 20) + '...',
                        });

                        const endpoint = getTokenSigningUrl(this.config);
                        const clientId = this.config.COGNITO_USER_POOL_CLIENT_ID;

                        console.debug('Preparing token refresh request', {
                            ...logContext,
                            endpoint,
                            clientId,
                        });

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
                            console.log('Token refresh request successful', {
                                ...logContext,
                                statusCode: response.status,
                                refreshSuccessful: true,
                            });

                            const tokens: { id_token: string | undefined; refresh_token: string | undefined; access_token: string | undefined; } = (await response.json() as any);

                            if (tokens.id_token) {
                                console.debug('New ID token received, validating', {
                                    ...logContext,
                                    hasNewIdToken: true,
                                    hasNewRefreshToken: !!tokens.refresh_token,
                                    hasNewAccessToken: !!tokens.access_token,
                                });

                                (req as any)[idTokenKey] = await this.cognitoTokenValidatorService.validate(tokens.id_token);

                                if ((req as any)[idTokenKey]) {
                                    console.log('New ID token validated successfully, updating cookies', {
                                        ...logContext,
                                        newTokenValid: true,
                                        email: (req as any)[idTokenKey]?.email,
                                    });

                                    this.cookieService.setCookies(res, tokens);
                                } else {
                                    console.error('New ID token validation failed after refresh', {
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
            } else {
                console.error('Token validation error (non-expiration)', {
                    ...logContext,
                    errorType: 'validation',
                });
            }
        }

        // User hydration phase
        if ((req as any)[idTokenKey]) {
            const email = (req as any)[idTokenKey]?.email;

            console.debug('Starting user hydration process', {
                ...logContext,
                email,
                hasValidToken: true,
            });

            try {
                (req as any)[requestUserKey] = await this.userHydraterService.hydrateUserByEmail(email);

                if ((req as any)[requestUserKey]) {
                    console.log('User hydrated successfully', {
                        ...logContext,
                        email,
                        userHydrated: true,
                        userId: (req as any)[requestUserKey]?.id,
                    });
                } else {
                    console.warn('User hydration returned null/undefined', {
                        ...logContext,
                        email,
                        userHydrated: false,
                    });
                }
            } catch (error: any) {
                console.error('Failed to hydrate user by email', {
                    ...logContext,
                    email,
                    error: error.message,
                    errorStack: error.stack,
                    userHydrated: false,
                });
            }
        } else {
            console.debug('Skipping user hydration - no valid token available', {
                ...logContext,
                hasValidToken: false,
            });
        }

        // Log final authorization state
        const finalState = {
            ...logContext,
            hasValidToken: !!(req as any)[idTokenKey],
            hasUser: !!(req as any)[requestUserKey],
            userEmail: (req as any)[idTokenKey]?.email,
            userId: (req as any)[requestUserKey]?.id,
        };

        console.log('Authorization and hydration process completed', finalState);
    }
}
