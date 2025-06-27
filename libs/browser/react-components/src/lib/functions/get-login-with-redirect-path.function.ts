import { extractValueFromQueryString, urlToPath } from "@onivoro/browser/react-common";

export function getLoginWithRedirectPath(loginWithRedirectPath: string, key = 'redirect') {
    const path = urlToPath(window.location.href);

    if (extractValueFromQueryString(key, path)) {
        return path;
    }

    return loginWithRedirectPath.replace(`:${key}`, urlToPath(window.location.href));
}