# @onivoro/isomorphic-common

Common utilities, functions, types, and constants shared between browser and server environments in the Onivoro monorepo. This library provides essential building blocks for TypeScript applications with a focus on type safety and consistent behavior across different runtime environments.

## Installation

```bash
npm install @onivoro/isomorphic-common
```

## Features

- **Isomorphic Design**: Works identically in browser and Node.js environments
- **String Manipulation**: Case conversion, formatting, and validation utilities
- **Array Operations**: Chunking, sorting, deduplication, and transformation functions
- **Date/Time Utilities**: Calendar operations, offset calculations, and time constants
- **Financial Functions**: Currency formatting and money calculations
- **Type Utilities**: TypeScript type helpers and interfaces
- **Validation Functions**: Data validation and parsing utilities
- **Testing Helpers**: Mock functions and test arrangement utilities
- **Constants**: Authentication headers, regex patterns, and time constants

## Constants

### Authentication Headers
```typescript
import { apiKeyHeader } from '@onivoro/isomorphic-common';

// Use in HTTP requests
const headers = {
  [apiKeyHeader]: 'your-api-key' // 'x-api-key'
};
```

### Time Constants
```typescript
import { MILLIS_PER_DAY, MILLIS_PER_HOUR, MILLIS_PER_MINUTE } from '@onivoro/isomorphic-common';

// Time constants (calculated from MILLIS_PER_MINUTE base)
const hoursInDay = MILLIS_PER_DAY / MILLIS_PER_HOUR; // 24
const minutesInHour = MILLIS_PER_HOUR / MILLIS_PER_MINUTE; // 60

// Set timeouts
setTimeout(() => {}, MILLIS_PER_MINUTE); // 1 minute timeout
```

### Regular Expressions
```typescript
import { 
  email, 
  phone, 
  zip, 
  v4, 
  dateIso8601, 
  numeric,
  ssn,
  ein 
} from '@onivoro/isomorphic-common';

// Validate email
const isValidEmail = email.test('user@example.com'); // true

// Validate phone number (format: 123-456-7890)
const isValidPhone = phone.test('123-456-7890'); // true

// Validate ZIP code (5 digits)
const isValidZip = zip.test('12345'); // true

// Validate UUID v4
const isValidUuid = v4.test('550e8400-e29b-41d4-a716-446655440000'); // true

// Validate ISO date (YYYY-MM-DD)
const isValidDate = dateIso8601.test('2023-12-31'); // true
```

## String Functions

### Case Conversion
```typescript
import { camelCase, kebabCase, snakeCase } from '@onivoro/isomorphic-common';

// camelCase(string: string): string
camelCase('hello world'); // 'helloWorld'
camelCase('--foo-bar--'); // 'fooBar'
camelCase('__FOO_BAR__'); // 'fooBar'

// kebabCase(string: string): string
kebabCase('Hello World'); // 'hello-world'
kebabCase('fooBar'); // 'foo-bar'

// snakeCase(string: string): string
snakeCase('Hello World'); // 'hello_world'
snakeCase('fooBar'); // 'foo_bar'
```

## Array Functions

### Array Manipulation
```typescript
import { 
  chunk, 
  removeElementAtIndex, 
  toUniqueArray 
} from '@onivoro/isomorphic-common';

// chunk<T>(array: T[], numDivisions: number): T[][]
// Divides array into N divisions (NOT chunks of size N)
chunk([1, 2, 3, 4, 5, 6], 3); // [[1, 2], [3, 4], [5, 6]] - 3 divisions
chunk([1, 2, 3, 4, 5], 2); // [[1, 2, 3], [4, 5]] - 2 divisions

// removeElementAtIndex<T>(array: T[], indexToRemove: number): T[]
removeElementAtIndex(['a', 'b', 'c'], 1); // ['a', 'c']

// toUniqueArray<TElement>(elements: TElement[]): TElement[]
toUniqueArray([1, 2, 2, 3, 3, 4]); // [1, 2, 3, 4]
```

### Sorting Functions
```typescript
import { 
  sortByName, 
  sortById, 
  sortNumbers 
} from '@onivoro/isomorphic-common';

// sortByName<TEntity extends { name: string }>(a: TEntity, b: TEntity): number
const users = [{ name: 'Bob' }, { name: 'Alice' }];
users.sort(sortByName); // [{ name: 'Alice' }, { name: 'Bob' }]

// sortById<TEntity extends { id: string }>(a: TEntity, b: TEntity): number
const items = [{ id: '3' }, { id: '1' }, { id: '2' }];
items.sort(sortById); // [{ id: '1' }, { id: '2' }, { id: '3' }]

// sortNumbers(a: number, b: number): number
const numbers = [3, 1, 4, 1, 5];
numbers.sort(sortNumbers); // [1, 1, 3, 4, 5]
```

## Date/Time Functions

### Date Operations
```typescript
import { 
  addOffset, 
  subtractOffset, 
  getDateRangeForMonth
} from '@onivoro/isomorphic-common';

// addOffset(input: string | Date | undefined | null): Date | undefined
const date = new Date('2023-01-15');
const withOffset = addOffset(date); // Adds timezone offset

// subtractOffset(input: string | Date | undefined | null): Date | undefined
const withoutOffset = subtractOffset(date); // Subtracts timezone offset

// getDateRangeForMonth(year: number, month: number): {startDate: Date, endDate: Date}
const { startDate, endDate } = getDateRangeForMonth(2023, 0); // January 2023 (month 0-indexed)
```

### Date Utilities
```typescript
import { 
  isValidDate, 
  parseBool
} from '@onivoro/isomorphic-common';

// isValidDate(dateString: string | Date): Date | undefined
const validDate = isValidDate('2023-01-15'); // Date object
const invalidDate = isValidDate('invalid'); // undefined

// parseBool(asc: string | boolean | null | undefined): boolean
parseBool('true'); // true
parseBool('false'); // false
parseBool(true); // true
parseBool(null); // false
```

## Financial Functions

```typescript
import { 
  formatUsd, 
  money, 
  toDollarsAndCents, 
  round 
} from '@onivoro/isomorphic-common';

// formatUsd(rawAmount?: number | string): string
formatUsd(1234.56); // '$1,234.56'
formatUsd('1234.56'); // '$1,234.56'
formatUsd(); // '$0.00'

// money(rawValue: number | string): string | undefined
money(19.99); // '$19.99'
money('abc'); // undefined

// toDollarsAndCents(input: string | number): string
toDollarsAndCents(19.99); // 'nineteen dollars and ninety-nine cents'
toDollarsAndCents(20); // 'twenty dollars'

// round(numberToRound: number, scalingFactor: number): number
round(19.999, 100); // 20.00 (rounds to nearest cent)
round(19.994, 100); // 19.99
```

## Data Transformation

### Enum Utilities
```typescript
import { 
  mapEnumToOptions
} from '@onivoro/isomorphic-common';

enum Status {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending'
}

// mapEnumToOptions<TEntity extends object>(enumeration: TEntity, includeBlank = true)
const options = mapEnumToOptions(Status);
// [{ display: '', value: '' }, { display: 'ACTIVE', value: 'active' }, ...]

const optionsNoBlank = mapEnumToOptions(Status, false);
// [{ display: 'ACTIVE', value: 'active' }, ...]
```

### Entity Utilities
```typescript
import { getUserFullName } from '@onivoro/isomorphic-common';

// getUserFullName(user: TNameable | undefined): string
const user = { firstName: 'John', lastName: 'Doe' };
getUserFullName(user); // 'John Doe'
getUserFullName(undefined); // 'undefined undefined'
```

## JSON Utilities

```typescript
import { 
  tryJsonParse, 
  tryJsonStringify 
} from '@onivoro/isomorphic-common';

// tryJsonParse<T>(parseable: string | null | undefined): T | null
const parsed = tryJsonParse<{name: string}>('{"name":"John"}'); // {name: 'John'}
const failed = tryJsonParse('invalid json'); // null

// tryJsonStringify<T>(object: T | null | undefined, fmtr?: any, spaces?: number): string | null
const json = tryJsonStringify({name: 'John'}); // '{"name":"John"}'
const formatted = tryJsonStringify({name: 'John'}, null, 2); // Pretty formatted JSON
```

## Utility Functions

```typescript
import { sleep } from '@onivoro/isomorphic-common';

// sleep(milliseconds = 0): Promise<void>
await sleep(1000); // Wait 1 second
await sleep(); // Wait 0 milliseconds (next tick)
```

## Type Definitions

### Interfaces
```typescript
import { 
  ILookup, 
  TNameable 
} from '@onivoro/isomorphic-common';

// Lookup interface for key-value pairs
const lookup: ILookup<string, number> = {
  display: 'Option 1',
  value: 1
};

// Nameable type
const user: TNameable = {
  firstName: 'John',
  lastName: 'Doe'
};
```

## License

This library is licensed under the MIT License. See the LICENSE file in this package for details.