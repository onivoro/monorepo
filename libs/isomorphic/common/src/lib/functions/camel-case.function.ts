// https://github.com/lodash/lodash/blob/main/src/camelCase.ts

import { toString } from './to-string.function';
import { upperFirst } from './upper-first.function';
import { words } from './words.function';

/**
 * Converts `string` to [camel case](https://en.wikipedia.org/wiki/CamelCase).
 *
 * @since 3.0.0
 * @category String
 * @param {string} [string=''] The string to convert.
 * @returns {string} Returns the camel cased string.
 * @see lowerCase, kebabCase, snakeCase, startCase, upperCase, upperFirst
 * @example
 *
 * camelCase('Foo Bar')
 * // => 'fooBar'
 *
 * camelCase('--foo-bar--')
 * // => 'fooBar'
 *
 * camelCase('__FOO_BAR__')
 * // => 'fooBar'
 */
export const camelCase = (string: string): string =>
    (words(toString(string).replace(/['\u2019]/g, '')) as string[]).reduce((result: string, word: string, index: number) => {
        word = word.toLowerCase();
        return result + (index ? upperFirst(word) : word);
    }, '');
