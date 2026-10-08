# @onivoro/isomorphic-jsonata

Helpers for evaluating [JSONata](https://jsonata.org) expressions with reusable function definitions, and for filling `{{PLACEHOLDER}}` templates whose placeholders map to JSONata expressions. Includes `JsonataExpressionService` for extracting, validating and normalizing those placeholders in template content.

## Installation

```bash
npm install @onivoro/isomorphic-jsonata @onivoro/isomorphic-common
```

`jsonata` is installed as a dependency; `@onivoro/isomorphic-common` is a peer dependency.

## API

### `executeJsonata<TContext>(expression, context, functions?): Promise<any>`

```typescript
executeJsonata<TContext>(
  expression: string | null | undefined,
  context: TContext,
  functions?: IJsonataFunctions
): Promise<any>
```

Compiles `expression` with `jsonata`, applies `functions`, and evaluates it against `context`. Returns `undefined` without evaluating when `expression` is empty, `null` or `undefined`. Errors from JSONata (syntax or evaluation) are thrown.

```typescript
import { executeJsonata } from '@onivoro/isomorphic-jsonata';

const total = await executeJsonata('$sum(items.price)', {
  items: [{ price: 2 }, { price: 3 }],
}); // 5
```

#### Functions (`IJsonataFunctions`)

```typescript
interface IJsonataFn {
  name: string; // without the leading $
  body: string; // JSONata source
}

interface IJsonataFunctions {
  headerFunctions?: IJsonataFn[];
  auxilaryHeaderFunctions?: IJsonataFn[];
  registerFunctions?: Array<{ name: string; fn: Function }>;
}
```

- **`headerFunctions`** and **`auxilaryHeaderFunctions`** are JSONata function definitions written into the expression as `$name := body;` bindings. An `auxilaryHeaderFunctions` entry replaces a `headerFunctions` entry with the same `name`; the remaining auxiliary entries are added after them. Newlines in `body` are replaced with spaces.
- **`registerFunctions`** are JavaScript functions registered with `registerFunction(name, fn)` on the compiled expression and called as `$name(...)`.

When there are header functions, the expression is wrapped in a block that declares them first, `( $name := body; ... expression )`, so they are in scope for any expression, block or not. With no header functions the expression is compiled as given.

```typescript
import { executeJsonata, IJsonataFunctions } from '@onivoro/isomorphic-jsonata';

const functions: IJsonataFunctions = {
  headerFunctions: [{ name: 'greet', body: 'function($n) { "Hello, " & $n }' }],
  registerFunctions: [{ name: 'shout', fn: (s: string) => s.toUpperCase() + '!' }],
};

await executeJsonata('$greet(name)', { name: 'Ada' }, functions); // 'Hello, Ada'
await executeJsonata('$shout(name)', { name: 'Ada' }, functions); // 'ADA!'
```

### `findAndReplace<TContext>(content, expressions, context, functions?): Promise<string>`

```typescript
findAndReplace<TContext>(
  content: string,
  expressions: IJsonataExpression[],
  context: TContext,
  functions?: IJsonataFunctions
): Promise<string>
```

For each `{ expression, code }` in `expressions` (in order), evaluates `code` with `executeJsonata(code, context, functions)` and replaces every occurrence of `{{expression}}` in `content` with the result. `expression` may be given with or without braces; it is trimmed and wrapped in `{{` `}}` before matching, and the match is exact and case-sensitive.

- A result of `undefined` (for example, a path that matches nothing) or `null` leaves the placeholder untouched. Any other result, including `0`, `false` and `''`, replaces it (converted with `String`). The result is inserted literally; `$&`, `$$` and similar replacement patterns in it are not expanded.
- An error in one expression is logged with `console.error` and skipped; the rest are still processed.

```typescript
import { findAndReplace, IJsonataExpression } from '@onivoro/isomorphic-jsonata';

const expressions: IJsonataExpression[] = [
  { expression: 'FIRST_NAME', code: 'user.first' },
  { expression: 'TOTAL', code: '$sum(items.price)' },
];

const text = await findAndReplace('Hi {{FIRST_NAME}}, your total is {{TOTAL}}.', expressions, { user: { first: 'Ada' }, items: [{ price: 2 }, { price: 3 }] }); // 'Hi Ada, your total is 5.'
```

### `JsonataExpressionService`

A stateless class (instantiate with `new`) for working with `{{...}}` placeholders in template content.

| Method                                                                                                                | Description                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `extractInterpolations(content: string)`                                                                              | All `{{...}}` matches in `content` (`RegExpMatchArray`), or `null` if there are none.                                                                                                                                               |
| `validateInterpolations(interpolations: RegExpMatchArray)`                                                            | Splits matches into `{ valid, invalid }`; a match containing `<` (e.g. markup inside the braces) is invalid.                                                                                                                        |
| `normalizeInterpolations(content: string, valid: any[])`                                                              | Normalizes each placeholder (collapses runs of whitespace, **upper-cases**, trims inside the braces) and rewrites `content` accordingly. Returns `{ normalizedInterpolations, updatedContent }`.                                    |
| `segregateUniqueInterpolations(normalizedInterpolations: string[], existingJsonataExpressions: IJsonataExpression[])` | Async. De-duplicates the placeholders and returns `{ novelInterpolations, uniqueNormalizedInterpolations }`, where `novelInterpolations` are those with no matching `expression` among the existing ones (compared without braces). |
| `removeBracesFromInterpolation(interpolation: string)`                                                                | `'{{ A }}'` becomes `'A'`.                                                                                                                                                                                                          |
| `removeBracesFromInterpolations(interpolations: string[])`                                                            | Array form of the above.                                                                                                                                                                                                            |
| `addBracesToInterpolation(interpolation: string)`                                                                     | `' A '` or `'{{A}}'` becomes `'{{A}}'`.                                                                                                                                                                                             |
| `addBracesToInterpolations(interpolations: string[])`                                                                 | Array form of the above.                                                                                                                                                                                                            |

```typescript
import { JsonataExpressionService } from '@onivoro/isomorphic-jsonata';

const svc = new JsonataExpressionService();
const content = 'Dear {{ first   name }}, total {{TOTAL}} {{x<b>}}';

const found = svc.extractInterpolations(content);
if (!found) throw new Error('no placeholders');

const { valid, invalid } = svc.validateInterpolations(found);
// valid: ['{{ first   name }}', '{{TOTAL}}'], invalid: ['{{x<b>}}']

const { normalizedInterpolations, updatedContent } = svc.normalizeInterpolations(content, valid);
// normalizedInterpolations: ['{{FIRST NAME}}', '{{TOTAL}}']
// updatedContent: 'Dear {{FIRST NAME}}, total {{TOTAL}} {{x<b>}}'

const { novelInterpolations } = await svc.segregateUniqueInterpolations(normalizedInterpolations, [{ expression: 'TOTAL', code: '$sum(items.price)' }]);
// novelInterpolations: ['{{FIRST NAME}}']
```

### Constants

| Export                            | Value                 |
| --------------------------------- | --------------------- |
| `REG_INTERPOLATION`               | `/{{.+?}}/g`          |
| `REG_MULTISPACE`                  | `/\s{2,}/g`           |
| `OPENING` / `CLOSING`             | `'{{'` / `'}}'`       |
| `OPENING_REGEX` / `CLOSING_REGEX` | `/\{\{/g` / `/\}\}/g` |

### Types

- `IJsonataExpression`: `{ expression: string; code: string }`, a placeholder name and the JSONata source that produces its value.
- `IJsonataFn`: `{ name: string; body: string }`.
- `IJsonataFunctions`: see [Functions](#functions-ijsonatafunctions).

## License

This library is licensed under the MIT License. See the LICENSE file in this package for details.
