// https://github.com/lodash/lodash/blob/main/src/.internal/getTag.ts

const toString = Object.prototype.toString

export function getTag(value: any): string {
    if (value == null) {
        return value === undefined ? '[object Undefined]' : '[object Null]'
    }
    return toString.call(value)
}
