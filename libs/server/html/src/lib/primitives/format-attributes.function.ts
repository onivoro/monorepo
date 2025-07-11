export function formatAttributes(attributes?: Record<string, any>) {
    if(!attributes) {
        return '';
    }

    return Object.entries(attributes)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ');
}
