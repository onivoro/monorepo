import { extractDecodedToken } from './extract-decoded-token.function';

export function extractTokenExpiration(authCookieName: string): number {
    const token = extractDecodedToken<Record<string, any> & {exp?: number}>(authCookieName);

    if(token?.exp) {
        return token.exp * 1000;
    }

    return 0;
}