import { tag as tagFunction } from "./tag.function";

export function selfClosingTag(
    tag: string,
    cssClass?: string,
    attributes?: Record<string, any>,
    styles?: Record<string, string>,
) {
    return tagFunction(
        tag,
        [],
        cssClass,
        attributes,
        styles,
    ).replace(`></${tag}>`, '/>')
}