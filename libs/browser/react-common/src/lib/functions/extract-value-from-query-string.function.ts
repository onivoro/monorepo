
export function extractValueFromQueryString(key: string, searchOverride?: string): string {
    const identifier = `${key}=`;
    const keyValuePairs = (searchOverride || window.location.search || '').replace('?', '').split('&').filter(_ => _.includes(identifier));

    if (!keyValuePairs.length) {
        return '';
    }

    return decodeURIComponent(keyValuePairs[0]?.replace(identifier, ''));
}