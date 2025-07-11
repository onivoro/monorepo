import { TAttributes } from "../types/attributes.type";
import { element } from "./element.function";

export function selfClosingElement(
    tag: string,
    attributes?: TAttributes,
) {
    return element(
        tag,
        [],
        attributes,
    ).replace(`></${tag}>`, '/>')
}