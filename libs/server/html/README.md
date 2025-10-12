# @onivoro/server-html

A TypeScript library for server-side HTML generation with a functional approach. Provides a simple, type-safe way to generate HTML strings on the server without any compilation or JSX.

## Installation

```bash
npm install @onivoro/server-html
```

## Overview

This library provides functional HTML element creators that generate HTML strings. Each element is a function that takes content and optional attributes.

## Core API

### Element Functions

The library exports element functions for common HTML tags:

```typescript
import { div, h1, p, button, anchor } from '@onivoro/server-html';

// Basic usage
const html = div(['Hello World']);
// Output: <div>Hello World</div>

// With attributes
const heading = h1(['Welcome'], { 
  id: 'main-title',
  style: { 'font-size': '2rem', color: 'blue' }
});
// Output: <h1 id="main-title" style="font-size: 2rem; color: blue;">Welcome</h1>

// Nested elements
const card = div([
  h2(['Card Title']),
  p(['This is the card content']),
  button(['Click me'], { onclick: 'handleClick()' })
]);
```

### Available Elements

Regular elements:
- `anchor`, `body`, `button`, `div`
- `h1`, `h2`, `h3`, `h4`, `h5`, `h6`
- `head`, `header`, `htm` (html), `main`
- `p`, `pre`, `style`
- `tab` (table), `tbody`, `td`, `th`, `thead`, `tr`

Self-closing elements:
- `img`

### Special Styling

The `anchor` and `button` elements come with default button styles that can be overridden:

```typescript
const styledButton = button(['Submit'], {
  style: { 
    // Default button styles are applied automatically
    // You can override them here
    'background-color': 'green'
  }
});
```

## Utility Functions

### Table Generator

Create HTML tables easily:

```typescript
import { table } from '@onivoro/server-html';

const columns = ['Name', 'Age', 'City'];
const rows = [
  ['John', '30', 'New York'],
  ['Jane', '25', 'London'],
  ['Bob', '35', 'Paris']
];

const htmlTable = table(columns, rows);
// Generates a complete table with alternating row colors
```

### Email Body Generator

Create formatted email bodies with consistent styling:

```typescript
import { emailBody } from '@onivoro/server-html';

const html = emailBody(
  'Welcome!',                    // title
  'Thanks for signing up',       // subtitle
  [                             // content
    p(['Your account is ready']),
    button(['Get Started'], { href: 'https://example.com' })
  ],
  'https://example.com/logo.png', // optional logo URL
  { 'font-family': 'Arial' }      // optional extra styles
);
```

## Low-Level Functions

For more control, use the low-level element creation functions:

```typescript
import { element, selfClosingElement } from '@onivoro/server-html';

// Create custom elements
const section = element('section', ['Content'], { class: 'my-section' });
const br = selfClosingElement('br', {});
```

## Deprecated API

The library includes deprecated functions prefixed with underscore (`_div`, `_h1`, etc.) that use the older `tag` and `selfClosingTag` functions. These are maintained for backward compatibility but should not be used in new code.

## Type Safety

All functions are fully typed with TypeScript:

```typescript
import { TAttributes, TElementRenderer } from '@onivoro/server-html';

// Attributes type for element properties
const attrs: TAttributes = {
  id: 'my-id',
  className: 'my-class',
  style: {
    display: 'flex',
    'align-items': 'center'
  }
};

// Element renderers return strings
const myDiv: string = div(['Content'], attrs);
```

## Examples

### Complete HTML Document

```typescript
import { htm, head, body, h1, div, p } from '@onivoro/server-html';

const document = htm([
  head([
    '<meta charset="UTF-8">',
    '<title>My Page</title>'
  ]),
  body([
    h1(['Welcome to My Site']),
    div([
      p(['This is a paragraph']),
      p(['Another paragraph'])
    ], { class: 'content' })
  ])
]);
```

### Dynamic Content

```typescript
const items = ['Apple', 'Banana', 'Orange'];

const list = div([
  h2(['Fruits']),
  ...items.map(item => div([item], { class: 'list-item' }))
]);
```

## License

MIT