// https://github.com/lodash/lodash/blob/main/src/isSymbol.ts

import { getTag } from './get-tag.function';

export function isSymbol(value: any): boolean {
    const type = typeof value;
    return (
        type === 'symbol' ||
        (type === 'object' && value != null && getTag(value) === '[object Symbol]')
    );
}
