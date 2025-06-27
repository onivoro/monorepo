export type TApiConfig = {
    apiUrl: string,
    uiUrl?: string,
    addHeaders?: (req: any) => Record<string, string>,
    on400?: (response: any) => any,
    on401?: (response: any) => any,
    on403?: (response: any) => any,
    on500?: (response: any) => any,
    onRequest?: (request: any) => any,
    onResponse?: (response: any) => any,
    onError?: (response: any) => any,
};