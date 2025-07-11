import { TAttributes } from "./attributes.type";

export type TElementRenderer = (
    content: Array<string | number>,
    attributes?: TAttributes,
) => string;