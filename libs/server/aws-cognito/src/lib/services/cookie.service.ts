import { Injectable } from "@nestjs/common";
import { TokensDto } from "../dtos/tokens.dto";
import { Response, Request } from "express";
import { extractOrigin } from "../functions/extract-origin.function";
import { ServerAwsCognitoOidcConfig } from "../server-aws-cognito-oidc-config.class";
import jwt from 'jsonwebtoken';
import { TKeysOf } from "@onivoro/isomorphic/common";

const isLocalhost = (origin: string) => /^localhost(:\d+)?$/.test(origin) || /^127\.0\.0\.1(:\d+)?$/.test(origin);

@Injectable()
export class CookieService {
    constructor(private config: ServerAwsCognitoOidcConfig) { }

    setCookies(res: Response<any, Record<string, any>>, tokens: TKeysOf<TokensDto, string | undefined>) {
        try {
            let origin: string = extractOrigin(res);
            const originNoProtocol = origin.replace(/^https?:\/\//, '');
            const host = originNoProtocol.split(':')[0];
            const isLocal = isLocalhost(host);
            let domain: string | undefined = undefined;
            if (!isLocal) {
                // Extract only the SLD + TLD (e.g., example.com from foo.bar.example.com)
                const parts = host.split('.');
                if (parts.length >= 2) {
                    // Handle cases like co.uk, com.au, etc. (naive, but covers most cases)
                    const tld = parts[parts.length - 1];
                    const sld = parts[parts.length - 2];
                    // Check for known double-barrel TLDs
                    const doubleBarrelTLDs = ['co.uk', 'com.au', 'org.uk', 'gov.uk', 'ac.uk'];
                    const lastTwo = parts.slice(-2).join('.');
                    if (doubleBarrelTLDs.includes(lastTwo) && parts.length >= 3) {
                        domain = `.${parts.slice(-3).join('.')}`;
                    } else {
                        domain = `.${sld}.${tld}`;
                    }
                }
            }

            const cookieOptions: any = {
                httpOnly: true,
                secure: !isLocal,
                sameSite: !isLocal ? 'strict' : false,
            };

            if (domain) {
                cookieOptions.domain = domain.endsWith('/') ? domain.slice(0, domain.lastIndexOf('/')) : domain;
            }

            ['id_token', 'refresh_token', 'access_token'].forEach(key => {
                const token = tokens[key as keyof TokensDto];
                if (token) {
                    try {
                        const decoded = jwt.decode(token);
                        if (decoded && typeof decoded === 'object' && decoded.exp) {

                            const now = Math.floor(Date.now() / 1000);
                            const maxAge = (decoded.exp - now) * 1000;

                            res.cookie(this.getTokenFullName(key as any), token, {
                                ...cookieOptions,
                                maxAge: maxAge > 0 ? maxAge : undefined
                            });
                        } else {
                            res.cookie(this.getTokenFullName(key as any), token, cookieOptions);
                        }
                    } catch (error: any) {
                        console.error(`error setting cookie ${key} for domain "${domain}" (isLocal: ${isLocal})`, error?.message || error);
                    }
                }
            });
        } catch (error: any) {
            console.error(`error determining domain`);
        }

    }

    getTokenFullName(tokenName: 'id_token' | 'refresh_token' | 'access_token') {
        return [this.config.COGNITO_DOMAIN_PREFIX, this.config.AWS_REGION, this.config.COGNITO_USER_POOL_CLIENT_ID, tokenName].join('___');
    }

    get(req: Request, tokenName: 'id_token' | 'refresh_token' | 'access_token') {
        const tokenFullName = this.getTokenFullName(tokenName);
        return (req?.cookies || {})[tokenFullName];
    }
}