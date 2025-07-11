import { TAttributes } from "../types/attributes.type";
import { formatAttributes } from "./format-attributes.function";
import { inlineStyle } from "./inline-style.function";

export function element(
    tag: string,
    content: Array<string | number>,
    attributes?: TAttributes
) {
    const { cssClass = '', style = undefined, ...attrs } = attributes || {};
    const classExp = cssClass ? ` class="${cssClass}"` : '';
    const attributesExp = attrs ? ` ${formatAttributes(attrs)}` : '';
    const styleExp = style ? ` ${inlineStyle(style)}` : '';

    return `<${tag}${classExp}${attributesExp}${styleExp}>${content.join?.('')}</${tag}>`;
}
