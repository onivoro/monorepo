// source https://github.com/lodash/lodash/blob/master/snakeCase.js

import { words } from "./words.function";

/**
 * Converts `string` to
 * [snake case](https://en.wikipedia.org/wiki/Snake_case).
 *
 * @since 3.0.0
 * @category String
 * @param {string} [string=''] The string to convert.
 * @returns {string} Returns the snake cased string.
 * @see camelCase, lowerCase, kebabCase, startCase, upperCase, upperFirst
 * @example
 *
 * snakeCase('Foo Bar')
 * // => 'foo_bar'
 *
 * snakeCase('fooBar')
 * // => 'foo_bar'
 *
 * snakeCase('--FOO-BAR--')
 * // => 'foo_bar'
 *
 * snakeCase('foo2bar')
 * // => 'foo_2_bar'
 */
export function snakeCase(string: string) {
  return (
    (words(string.replace(/['\u2019]/g, '')) as string[]).reduce((result: string, word: string, index: number) => (
      result + (index ? '_' : '') + word.toLowerCase()
    ), '')
  );
}
