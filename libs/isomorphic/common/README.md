# @onivoro/isomorphic-common

Common utilities, functions, types, and constants shared between browser and server environments. This comprehensive library provides essential building blocks for TypeScript applications with a focus on type safety, reliability, and consistent behavior across different runtime environments.

## Installation

```bash
npm install @onivoro/isomorphic-common
```

## Features

- **Isomorphic Design**: Works identically in browser and Node.js environments
- **String Manipulation**: Case conversion, formatting, and validation utilities
- **Array Operations**: Chunking, sorting, deduplication, and transformation functions
- **Date/Time Utilities**: Calendar operations, offset calculations, and formatting
- **Financial Functions**: Currency formatting, money calculations, and validation
- **Type Utilities**: Advanced TypeScript type helpers and interfaces
- **Validation Functions**: Data validation and parsing utilities
- **Testing Helpers**: Mock functions and test arrangement utilities
- **Constants**: Common values, regex patterns, and configuration constants

## Quick Start

### String Operations

```typescript
import { 
  camelCase, 
  kebabCase, 
  snakeCase, 
  upperFirst,
  sanitizeFilename,
  formatUsd 
} from '@onivoro/isomorphic-common';

// Case conversions
camelCase('hello world'); // 'helloWorld'
kebabCase('Hello World'); // 'hello-world'
snakeCase('Hello World'); // 'hello_world'
upperFirst('hello'); // 'Hello'

// File operations
sanitizeFilename('My File/Name?.txt'); // 'My File Name .txt'

// Currency formatting
formatUsd(1234.56); // '$1,234.56'
formatUsd('1234.56'); // '$1,234.56'
```

### Array Manipulation

```typescript
import { 
  chunk, 
  toUniqueArray, 
  removeElementAtIndex,
  sortByName,
  sortById,
  sortNumbers
} from '@onivoro/isomorphic-common';

// Chunking arrays
chunk([1, 2, 3, 4, 5, 6], 3); // [[1, 2], [3, 4], [5, 6]]

// Remove duplicates
toUniqueArray([1, 2, 2, 3, 3, 4]); // [1, 2, 3, 4]

// Remove element by index
removeElementAtIndex(['a', 'b', 'c'], 1); // ['a', 'c']

// Sorting utilities
sortByName([{name: 'Bob'}, {name: 'Alice'}]); // [{name: 'Alice'}, {name: 'Bob'}]
sortById([{id: 3}, {id: 1}, {id: 2}]); // [{id: 1}, {id: 2}, {id: 3}]
sortNumbers([3, 1, 4, 1, 5]); // [1, 1, 3, 4, 5]
```

### Date and Time Operations

```typescript
import { 
  addOffset, 
  subtractOffset,
  getDateRangeForMonth,
  splitDateRangeIntoDays,
  isValidDate,
  tryParseDate,
  toCalendarDate,
  fromCalendarDate
} from '@onivoro/isomorphic-common';

// Date offset calculations
const date = new Date('2023-01-15');
addOffset(date, 7); // Add 7 days
subtractOffset(date, 2); // Subtract 2 days

// Monthly date ranges
getDateRangeForMonth(2023, 0); // January 2023 range

// Date validation
isValidDate(new Date('2023-01-15')); // true
isValidDate(new Date('invalid')); // false

// Safe date parsing
tryParseDate('2023-01-15'); // Date object or null
```

### Financial and Money Operations

```typescript
import { 
  money, 
  toDollarsAndCents,
  round,
  formatUsd 
} from '@onivoro/isomorphic-common';

// Money calculations (in cents)
const price = money(19.99); // 1999 cents
const tax = money(price * 0.08); // Calculate tax
const total = price + tax;

// Convert back to dollars
toDollarsAndCents(total); // { dollars: 21, cents: 59 }

// Rounding
round(19.999, 2); // 20.00
round(19.994, 2); // 19.99

// Currency display
formatUsd(total / 100); // '$21.59'
```

## Usage Examples

### Data Transformation

```typescript
import { 
  mapEnumToOptions,
  mapEntitiesToOptions,
  convertObjectToLiteral,
  propertiestoArray
} from '@onivoro/isomorphic-common';

enum Status {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending'
}

// Convert enum to dropdown options
const statusOptions = mapEnumToOptions(Status);
// [{ label: 'Active', value: 'active' }, ...]

// Convert entities to options
const users = [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }];
const userOptions = mapEntitiesToOptions(users, 'name', 'id');
// [{ label: 'John', value: 1 }, { label: 'Jane', value: 2 }]
```

### Boolean and String Parsing

```typescript
import { 
  parseBool,
  fromBooleanString,
  toBooleanString,
  fromCsvString,
  toCsvString
} from '@onivoro/isomorphic-common';

// Boolean parsing
parseBool('true'); // true
parseBool('1'); // true
parseBool('yes'); // true
parseBool('false'); // false

// CSV operations
const items = fromCsvString('apple,banana,cherry');
// ['apple', 'banana', 'cherry']

toCsvString(['apple', 'banana', 'cherry']);
// 'apple,banana,cherry'
```

### Testing Utilities

```typescript
import { 
  arrangeActAssert,
  mockCalls 
} from '@onivoro/isomorphic-common';

// Test structure helper
const testCase = arrangeActAssert({
  arrange: () => ({ input: 'test data' }),
  act: (arranged) => processData(arranged.input),
  assert: (result) => expect(result).toBeTruthy()
});

// Mock function calls tracking
const mockTracker = mockCalls();
mockTracker.track('functionName', ['arg1', 'arg2']);
mockTracker.getCalls('functionName'); // [['arg1', 'arg2']]
```

## API Reference

### String Functions

#### Case Conversion
- `camelCase(string)` - Convert to camelCase
- `kebabCase(string)` - Convert to kebab-case  
- `snakeCase(string)` - Convert to snake_case
- `upperFirst(string)` - Capitalize first letter

#### String Utilities
- `sanitizeFilename(filename)` - Remove invalid filename characters
- `removeAlphaChars(string)` - Remove alphabetic characters
- `words(string)` - Split string into words array
- `toString(value)` - Convert value to string safely

### Array Functions

#### Array Manipulation
- `chunk<T>(array, numDivisions)` - Split array into chunks
- `toUniqueArray<T>(array)` - Remove duplicate elements
- `removeElementAtIndex<T>(array, index)` - Remove element by index

#### Sorting Functions
- `sortByName<T>(array)` - Sort objects by name property
- `sortById<T>(array)` - Sort objects by id property
- `sortByFullName<T>(array)` - Sort objects by full name
- `sortByCreatedAt<T>(array)` - Sort objects by creation date
- `sortNumbers(array)` - Sort numeric array

### Date/Time Functions

#### Date Operations
- `addOffset(date, days)` - Add days to date
- `subtractOffset(date, days)` - Subtract days from date
- `getDateRangeForMonth(year, month)` - Get month's date range
- `getDateLastMonth()` - Get previous month's date
- `splitDateRangeIntoDays(start, end)` - Split range into daily intervals

#### Date Utilities
- `isValidDate(date)` - Check if date is valid
- `tryParseDate(string)` - Safely parse date string
- `toCalendarDate(date)` - Convert to calendar format
- `fromCalendarDate(string)` - Parse calendar date string
- `useDate(date)` - React hook for date handling

#### Time Constants
- `MILLIS_PER_MINUTE` - Milliseconds in a minute
- `MILLIS_PER_HOUR` - Milliseconds in an hour
- `MILLIS_PER_DAY` - Milliseconds in a day

### Financial Functions

#### Money Operations
- `money(amount)` - Convert dollars to cents
- `toDollarsAndCents(cents)` - Convert cents to dollars/cents object
- `formatUsd(amount)` - Format as USD currency
- `round(number, precision)` - Round to decimal places

### Type Utilities

#### Interfaces
- `ILookup<T>` - Key-value lookup interface
- `IAccessToken` - Access token structure
- `IEntityProvider<T>` - Entity provider interface

#### Type Helpers
- `KeysOf<T>` - Extract keys of type T
- `Createable<T>` - Type for creatable entities
- `Nameable` - Type for entities with name property
- `Company` - Company type definition

### Data Transformation

#### Enum Utilities
- `mapEnumToOptions(enum)` - Convert enum to option array
- `mapEnumToArrayOfValues(enum)` - Convert enum to value array
- `mapEnumToLookupArray(enum)` - Convert enum to lookup array

#### Object Utilities
- `convertObjectToLiteral(object)` - Convert to literal object
- `propertiesToArray(object)` - Convert properties to array
- `mapEntitiesToOptions(entities, labelKey, valueKey)` - Convert entities to options

### Validation Functions

#### Data Validation
- `parseBool(value)` - Parse boolean from various formats
- `isSymbol(value)` - Check if value is symbol
- `tryJsonParse(string)` - Safely parse JSON
- `tryJsonStringify(object)` - Safely stringify JSON

#### String Validation
- `fromBooleanString(string)` - Convert string to boolean
- `toBooleanString(boolean)` - Convert boolean to string
- `fromCsvString(string)` - Parse CSV string
- `toCsvString(array)` - Convert array to CSV

### Utility Functions

#### General Utilities
- `sleep(milliseconds)` - Async sleep function
- `getTag(value)` - Get object type tag
- `getUserFullName(user)` - Get user's full name
- `toDecimalBase(number, base)` - Convert to decimal base

#### Testing Helpers
- `arrangeActAssert(config)` - Structure test cases
- `mockCalls()` - Track mock function calls

### Constants

#### Headers and Authentication
- `API_ID_HEADER` - API ID header constant
- `API_KEY_HEADER` - API key header constant  
- `AUTH_COOKIE_NAME` - Authentication cookie name

#### Regular Expressions
- `REGEXES` - Common regex patterns object

## Advanced Usage

### Custom Type Guards

```typescript
import { isSymbol, isValidDate } from '@onivoro/isomorphic-common';

function processValue(value: unknown) {
  if (isSymbol(value)) {
    return value.toString();
  }
  
  if (value instanceof Date && isValidDate(value)) {
    return value.toISOString();
  }
  
  return String(value);
}
```

### Complex Data Transformations

```typescript
import { 
  chunk, 
  mapEntitiesToOptions, 
  sortByName,
  toUniqueArray 
} from '@onivoro/isomorphic-common';

function processUserData(users: User[]) {
  return chunk(
    toUniqueArray(
      sortByName(users)
    ),
    10 // Process in batches of 10
  ).map(batch => 
    mapEntitiesToOptions(batch, 'fullName', 'id')
  );
}
```

### Date Range Operations

```typescript
import { 
  getDateRangeForMonth,
  splitDateRangeIntoDays,
  addOffset,
  subtractOffset 
} from '@onivoro/isomorphic-common';

function getMonthlyReportDates(year: number, month: number) {
  const { start, end } = getDateRangeForMonth(year, month);
  
  // Add buffer days
  const reportStart = subtractOffset(start, 1);
  const reportEnd = addOffset(end, 1);
  
  return splitDateRangeIntoDays(reportStart, reportEnd);
}
```

## License

MIT