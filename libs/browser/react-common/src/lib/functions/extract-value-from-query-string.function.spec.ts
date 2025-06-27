import { extractValueFromQueryString } from './extract-value-from-query-string.function';

describe('extractValueFromQueryString', () => {
    it.each([
        ['?foo=bar', 'foo', 'bar'],
        ['?foo=b%20a%20r', 'foo', 'b a r'],
        ['', 'foo', ''],
        ['?hot=chocolate&foo=bar', 'foo', 'bar'],
    ])('worx', (search, key, expectedValue) => {
        expect(extractValueFromQueryString(key, search)).toEqual(expectedValue);
    });
});