export type TSelfClosingHtmlElementRenderer = (
    cssClass?: string,
    attributes?: Record<string, any>,
    styles?: Record<string, string>,
) => string;