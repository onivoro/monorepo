export function pathToUrl(path: string) {
    return window.location.origin + (`/${path}`.replace('//', '/'));
}