export function resolveUrls(nonProdApiUrl: string, overrideUrl = '', OVERRIDE_BASE_URL_VARIABLE_NAME = '') {
    const apiUrlDefinedByEnv = ((import.meta as any).env || {}).VITE_API_URL;

    return {
        api: (OVERRIDE_BASE_URL_VARIABLE_NAME && (window as any)[OVERRIDE_BASE_URL_VARIABLE_NAME]) || (
            apiUrlDefinedByEnv || overrideUrl || ((!location.port || location.port === '80') ? '' : nonProdApiUrl)
        ),
        ui: location.origin,
    };
}
