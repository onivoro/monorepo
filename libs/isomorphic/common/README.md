# @onivoro/isomorphic-common

Utilities, types, and constants shared between browser and server code in the Onivoro monorepo. No runtime dependencies beyond `tslib`.

## Installation

```bash
npm install @onivoro/isomorphic-common
```

## Constants

### Headers

```typescript
import { apiKeyHeader, apiIdHeader } from '@onivoro/isomorphic-common';

const headers = {
  [apiKeyHeader]: 'your-api-key', // 'x-api-key'
  [apiIdHeader]: 'api-identifier', // 'x-api-id'
};
```

### Time

```typescript
import { MILLIS_PER_DAY, MILLIS_PER_HOUR, MILLIS_PER_MINUTE } from '@onivoro/isomorphic-common';

MILLIS_PER_MINUTE; // 60_000
MILLIS_PER_HOUR; // 3_600_000
MILLIS_PER_DAY; // 86_400_000
```

### Regular Expressions

```typescript
import { email, phone, zip, v4, dateIso8601, numeric, ssn, ein } from '@onivoro/isomorphic-common';

email.test('user@example.com'); // true
phone.test('123-456-7890'); // true
zip.test('12345'); // true
v4.test('550e8400-e29b-41d4-a716-446655440000'); // true
dateIso8601.test('2023-12-31'); // true (also accepts 1-digit month/day)
numeric.test('123.45'); // true (digits and dots only)
ssn.test('123-45-6789'); // true
ein.test('12-3456789'); // true
```

All exported patterns:

| Name                                                                  | Pattern / purpose                                       |
| --------------------------------------------------------------------- | ------------------------------------------------------- | ------ |
| `oneOrMoreSpaces`, `multipleSpaces`                                   | `/\s{1,}/g`, `/\s{2,}/g` (global, for `replace`)        |
| `comma`                                                               | `/,/g`                                                  |
| `dashesLettersNumbers`, `dashesLettersNumbersSpaces`                  | letters, digits, `-` (and whitespace), case-insensitive |
| `zip`                                                                 | 5 digits                                                |
| `phone`                                                               | `123-456-7890`                                          |
| `phonePlusOne`                                                        | `+1` followed by 10 digits                              |
| `code`                                                                | 6 digits                                                |
| `url`, `protocol`                                                     | `http(s)://` URLs / the protocol prefix                 |
| `firstSpaceLast`                                                      | first and last name separated by a space                |
| `passwordNumber`, `passwordUpper`, `passwordLower`, `passwordSpecial` | password character-class checks                         |
| `ssn`, `lastFourSocial`                                               | `123-45-6789`, 4 digits                                 |
| `ein`                                                                 | `12-3456789`                                            |
| `duns`                                                                | 9 digits                                                |
| `numeric`                                                             | digits and `.` only (also matches `''`)                 |
| `stateShort`                                                          | two uppercase letters                                   |
| `email`, `domain`, `emailDomain`                                      | email address, domain name, email domain part           |
| `v4`                                                                  | UUID v4                                                 |
| `dateIso8601`                                                         | `YYYY-M(M)-D(D)`                                        |
| `dateIso8601WithTime`                                                 | `YYYY-MM-DDTHH:mm:ss.sssZ`                              |
| `decimalRegex`                                                        | `/(\d                                                   | \.)/g` |
| `slashR`                                                              | `/\r/g`                                                 |

Patterns with the `g` flag are stateful when used with `.test()`; prefer them with `replace`/`match`.

## Strings

### Case conversion (ported from lodash)

```typescript
import { camelCase, kebabCase, snakeCase, upperFirst, words, unicodeWords } from '@onivoro/isomorphic-common';

camelCase('hello world'); // 'helloWorld'
camelCase('__FOO_BAR__'); // 'fooBar'
kebabCase('Hello World'); // 'hello-world'
kebabCase('fooBar'); // 'foo-bar'
snakeCase('fooBar'); // 'foo_bar'
snakeCase('foo2bar'); // 'foo_2_bar'
upperFirst('hELLO'); // 'Hello' (first char upper, rest lower)
words('fooBar baz'); // ['foo', 'Bar', 'baz']
words('a-b c', /[^ ]+/g); // ['a-b', 'c']
unicodeWords('fooBar'); // ['foo', 'Bar'] (the unicode-aware splitter used by words)
```

### Other string helpers

```typescript
import { sanitizeFilename, removeAlphaChars, fromBooleanString, toBooleanString, parseBool, fromCsvString, toCsvString, isSymbol } from '@onivoro/isomorphic-common';

// Replaces non-ASCII and / ? : \ { ^ ' } % ` ] > [ ~ < # | " ! * with '_', collapses repeats, trims
sanitizeFilename('file:name?.txt'); // 'file_name_.txt'
sanitizeFilename('invalid/file\\name'); // 'invalid_file_name'

removeAlphaChars('$1,234.56'); // '1234.56' (keeps digits and dots; undefined for falsy input)

fromBooleanString('true'); // true (only the exact string 'true')
toBooleanString(true); // 'true'
toBooleanString(); // 'false'

parseBool('true'); // true
parseBool(true); // true
parseBool('false'); // false
parseBool(null); // false

fromCsvString(' a, b ,c'); // ['a', 'b', 'c'] ([] for empty/undefined)
toCsvString(['a', 'b']); // 'a,b'

isSymbol(Symbol('x')); // true
```

## Arrays

```typescript
import { chunk, removeElementAtIndex, toUniqueArray } from '@onivoro/isomorphic-common';

// chunk<T>(array: T[], numDivisions: number): T[][]
// Splits into at most numDivisions groups (NOT groups of size N); throws if numDivisions <= 0
chunk([1, 2, 3, 4, 5, 6], 3); // [[1, 2], [3, 4], [5, 6]]
chunk([1, 2, 3, 4, 5], 2); // [[1, 2, 3], [4, 5]]

removeElementAtIndex(['a', 'b', 'c'], 1); // ['a', 'c'] (new array)
toUniqueArray([1, 2, 2, 3, 3, 4]); // [1, 2, 3, 4]
```

### Sorting comparators

```typescript
import { sortByName, sortById, sortByFullName, sortByCreatedAt, sortNumbers, sortByStringFactory, sortByNumberFactory } from '@onivoro/isomorphic-common';

[{ name: 'Bob' }, { name: 'Alice' }].sort(sortByName); // Alice, Bob (localeCompare)
[{ id: '3' }, { id: '1' }].sort(sortById); // '1', '3' (localeCompare)
users.sort(sortByFullName); // by `${firstName} ${lastName}`
rows.sort(sortByCreatedAt); // ascending createdAt (Date or string)
[3, 1, 4, 1, 5].sort(sortNumbers); // [1, 1, 3, 4, 5] (returns 0 for equal values)

// Factories build a comparator for one property
people.sort(sortByStringFactory<Person>('lastName')); // localeCompare on the stringified value
people.sort(sortByNumberFactory<Person>('age')); // numeric; missing values treated as 0
```

## Dates

```typescript
import { tryParseDate, isValidDate, addOffset, subtractOffset, fromCalendarDate, toCalendarDate, toStartOfDay, toEndOfDay, getDateRangeForMonth, getDateLastMonth, splitDateRangeIntoDays } from '@onivoro/isomorphic-common';

tryParseDate('2023-01-15'); // Date
tryParseDate('invalid'); // undefined (Date inputs are returned as-is)
isValidDate('2023-01-15'); // Date
isValidDate('invalid'); // undefined

// Shift by the local timezone offset
addOffset('2023-12-23'); // in UTC-6: 2023-12-23T06:00:00.000Z
subtractOffset(new Date()); // Date | undefined

// Calendar dates (YYYY-MM-DD) <-> Dates, compensating for the local offset
fromCalendarDate('2023-12-23'); // Date at local midnight, or null
toCalendarDate(new Date()); // 'YYYY-MM-DD' or undefined

// Date-only strings snap to the UTC day boundary; strings containing 'T' are parsed unchanged
toStartOfDay('2023-01-15'); // 2023-01-15T00:00:00.000Z
toEndOfDay('2023-01-15'); // 2023-01-15T23:59:59.999Z

// month is 1-based; endDate is the first instant of the next month (UTC)
getDateRangeForMonth(2023, 1);
// { startDate: 2023-01-01T00:00:00.000Z, endDate: 2023-02-01T00:00:00.000Z }

getDateLastMonth(); // a Date that falls in the previous month (today minus (UTC day-of-month + 1) days)

// Inclusive list of YYYY-MM-DD strings; [] if either bound is missing or not YYYY-MM-DD
splitDateRangeIntoDays({ from: '2024-01-01', to: '2024-01-03' });
// ['2024-01-01', '2024-01-02', '2024-01-03']
```

## Money and Numbers

```typescript
import { formatUsd, money, toDollarsAndCents, toWords, round, toDecimalBase } from '@onivoro/isomorphic-common';

formatUsd(1234.56); // '$1,234.56'
formatUsd('1234.56'); // '$1,234.56'
formatUsd(); // '$0.00'

money(19.99); // '$19.99'
money('$1,234.567'); // '$1,234.57' (non-numeric chars stripped first)
money('abc'); // undefined
money(0); // '$0.00'
money(undefined); // undefined (also null and '')

toWords(1234); // 'one thousand, two hundred thirty-four' (integer part only)
toDollarsAndCents(19.99); // 'nineteen dollars and ninety-nine cents'
toDollarsAndCents(20); // 'twenty dollars'

round(19.999, 100); // 20
round(19.994, 100); // 19.99

// toDecimalBase(n: string | number, base = 16)
toDecimalBase('FF'); // 255
toDecimalBase('101', 2); // 5
```

## Objects and Enums

```typescript
import { propertiesToArray, convertObjectToLiteral, mapEnumToOptions, mapEnumToLookupArray, mapEnumToArrayOfValues, mapEntitiesToOptions, getUserFullName } from '@onivoro/isomorphic-common';

propertiesToArray({ a: { b: { c: 1 } }, d: 2 }); // ['a.b.c', 'd']

// convertObjectToLiteral(literalFn, delimiter, keyValuePairs)
// Skips null/undefined/'' values (keeps 0 and false); values are stringified before literalFn
convertObjectToLiteral((k, v) => `${k}=${v}`, ' AND ', { qty: 337, price: 0, note: null });
// 'qty=337 AND price=0'

enum Status {
  ACTIVE = 'active',
  ON_HOLD = 'on_hold',
}

mapEnumToOptions(Status);
// [{ display: '', value: '' }, { value: 'active', display: 'ACTIVE' }, { value: 'on_hold', display: 'ON HOLD' }]
mapEnumToOptions(Status, false); // same, without the blank option
mapEnumToLookupArray(Status); // same as mapEnumToOptions(Status, false)
mapEnumToArrayOfValues(Status); // ['active', 'on_hold']
// Underscores in keys become spaces in `display`. Numeric enums include TypeScript's reverse mappings.

// Options from a normalized entity map, in `ids` order; display falls back to id
mapEntitiesToOptions({ a: { id: 'a', name: 'Alpha' }, b: { id: 'b' } }, ['a', 'b']);
// [{ display: '', value: '' }, { value: 'a', display: 'Alpha' }, { value: 'b', display: 'b' }]

getUserFullName({ firstName: 'John', lastName: 'Doe' }); // 'John Doe'
getUserFullName(undefined); // 'undefined undefined'
```

## JSON

```typescript
import { tryJsonParse, tryJsonStringify } from '@onivoro/isomorphic-common';

tryJsonParse<{ name: string }>('{"name":"John"}'); // { name: 'John' }
tryJsonParse('invalid json'); // null

tryJsonStringify({ name: 'John' }); // '{"name":"John"}'
tryJsonStringify({ name: 'John' }, null, 2); // pretty-printed
tryJsonStringify(undefined); // null (also null if stringify throws)
```

## Async and Profiling

```typescript
import { sleep, profileTime } from '@onivoro/isomorphic-common';

await sleep(1000);
await sleep(); // 0 ms

// Logs start, end, and elapsed seconds via console.log, then returns fn's result
const users = await profileTime(() => fetchUsers());
```

## Testing Helpers

```typescript
import { arrangeActAssert, mockCalls, useDate } from '@onivoro/isomorphic-common';

// Must be awaited. Each step may be async; assert receives the arranged object plus `result`.
await arrangeActAssert({
  arrange: () => ({ value: 5 }),
  act: ({ value }) => value * 2,
  assert: ({ result }) => expect(result).toBe(10),
});

// Labels a jest mock's calls, handy for snapshots
const fn = jest.fn();
fn('first');
fn('second');
mockCalls(fn); // { 'mock-calls -->> 2 invocation(s)': [['first'], ['second']] }
mockCalls(fn, 'save'); // { 'save -->> 2 invocation(s)': [...] }

// Replaces the global Date so `new Date()` and `Date.now()` return the given instant while fn runs
await useDate('2020-01-01T00:00:00.000Z', async () => {
  expect(new Date().toISOString()).toBe('2020-01-01T00:00:00.000Z');
});
```

`useDate` restores `Date` once `fn` settles, whether it resolves or rejects; a rejection is rethrown.

## Types

```typescript
import { ILookup, TNameable, IAccessToken, TCreateable, TKeysOf, IEntityProvider, IAxiosWrappedNestException } from '@onivoro/isomorphic-common';

const option: ILookup<string, number> = { display: 'Option 1', value: 1 };

const person: TNameable = { firstName: 'John', lastName: 'Doe' };

const token: IAccessToken = {
  id: 'user-1',
  roleId: 'admin',
  type: 'user', // 'user' | 'machine'
  companyId: 'co-1', // optional, as are brokerId and exp
  exp: 1735689600,
};

const row: TCreateable = { createdAt: new Date() }; // createdAt: Date | string

// Maps every key of the source type to the given value type
type Flags = TKeysOf<{ a: string; b: number }, boolean>; // { a: boolean; b: boolean }

// CRUD contract: getOne, getMany, postOne, postMany, delete, put, patch
type UserProvider = IEntityProvider<User, FindOneOptions, FindManyOptions, FindOptionsWhere, DeepPartial<User>>;

// Shape of a NestJS HttpException body as seen in an axios error response
const err: IAxiosWrappedNestException = { statusCode: 400, error: 'Bad Request', message: 'Invalid id' };
```

## License

MIT. See the LICENSE file in this package.
