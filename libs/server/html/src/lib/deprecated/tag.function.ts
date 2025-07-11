import { formatAttributes } from "../primitives/format-attributes.function";
import { inlineStyle } from "../primitives/inline-style.function";

export function tag(
    tag: string,
    content: Array<string | number>,
    cssClass?: string,
    attributes?: Record<string, any>,
    styles?: Record<string, string>,
) {
    const classExp = cssClass ? ` class="${cssClass}"` : '';
    const attributesExp = attributes ? ` ${formatAttributes(attributes)}` : '';
    const styleExp = styles ? ` ${inlineStyle(styles)}` : '';

    return `<${tag}${classExp}${attributesExp}${styleExp}>${content.join?.('')}</${tag}>`;
}
