import { createCookieService } from "./create-cookie-service.function";
import { decodeToken } from "./decode-token.function";

export function extractDecodedToken<IAccessToken>(authCookieName: string) {
    return decodeToken<IAccessToken>(createCookieService().get(authCookieName));
}