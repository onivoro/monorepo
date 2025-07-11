export type THtmlElementRenderer = (
    content: Array<string | number>,
    cssClass?: string,
    attributes?: Record<string, any>,
    styles?: Record<string, string>,
) => string;