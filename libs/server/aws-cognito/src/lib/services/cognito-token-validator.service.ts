import { Injectable, OnModuleInit } from "@nestjs/common";
import { JwtHeader, decode, verify } from 'jsonwebtoken';
import jwkToPem from 'jwk-to-pem';
import { ServerAwsCognitoConfig } from "../server-aws-cognito-config.class";
import { CognitoJWK } from "../types/cognito-jwk.type";
import { getTokenIssuerUrl } from "../functions/get-token-issuer-url.function";

@Injectable()
export class CognitoTokenValidatorService implements OnModuleInit {
    private jwks: { keys: CognitoJWK[] } = { keys: [] };
    private jwksByKids: Record<CognitoJWK['kid'], CognitoJWK> = {};
    private pemsByKids: Record<CognitoJWK['kid'], string> = {};

    get issuer() {
        return getTokenIssuerUrl(this.config);
    }

    async onModuleInit() {
        await this.getJWKS();
    }

    async validate(_token?: string | undefined) {
        if (!_token) {
            return;
        }

        try {
            const token = _token?.replace('Bearer ', '');

            const decodedHeader = decode(token, { complete: true })?.header as JwtHeader;

            if (!decodedHeader?.kid) {
                console.error(`Invalid/missing token header`);
            }

            const pem = await this.getPemByKid(decodedHeader.kid);

            if (!pem) {
                console.error(`No PEM available for kid "${decodedHeader.kid}"`);

                return;
            }

            const verifiedToken = verify(token, pem, {
                issuer: this.issuer,
                audience: this.config.COGNITO_USER_POOL_CLIENT_ID,
                algorithms: ['RS256']
            });

            return verifiedToken;
        } catch (error: any) {
            if (error?.name === 'TokenExpiredError') {
                throw error;
            }
            console.error({ detail: 'Token validation failed', error });
            return;
        }
    }

    private async getPemByKid(kid: string | undefined) {
        const matchingKey = await this.getKeyByKid(kid);

        if (!matchingKey) {
            return;
        }

        this.pemsByKids[kid!] = (
            this.pemsByKids[kid!] || jwkToPem(matchingKey as any)
        );

        return this.pemsByKids[kid!];
    }

    private async getKeyByKid(kid: string | undefined) {
        if (!kid) {
            return;
        }

        await this.getJWKS();

        const matchingKey = this.jwksByKids[kid];

        if (!matchingKey) {
            console.error(`No matching key found for header.kid "${kid}"`);

            return;
        }

        return matchingKey;
    }

    private async getJWKS(): Promise<typeof CognitoTokenValidatorService.prototype.jwks> {
        if (this.jwks?.keys?.length) {
            return this.jwks;
        }

        const response = await fetch(
            `${this.issuer}/.well-known/jwks.json`
        );

        if (!response.ok) {
            console.error('Failed to fetch JWKS');

            return { keys: [] };
        }

        this.jwks = await response.json() as typeof CognitoTokenValidatorService.prototype.jwks;

        this.jwksByKids = this.jwks.keys.reduce((_, jwk) => {
            _[jwk.kid] = jwk;

            return _;
        }, {} as typeof CognitoTokenValidatorService.prototype.jwksByKids);

        return this.jwks;
    }

    constructor(private config: ServerAwsCognitoConfig) { }
}
