# @onivoro/server-html

A TypeScript library for server-side HTML generation with a functional approach. This package provides a comprehensive set of utilities for creating HTML documents, email templates, and structured markup programmatically.

## Features

- **Functional HTML Generation**: Create HTML elements using functional composition
- **Type-Safe**: Full TypeScript support with proper type definitions
- **Email Templates**: Pre-built email body and table components
- **Styling Support**: Built-in style constants and inline styling utilities
- **Flexible Attributes**: Support for CSS classes, inline styles, and custom attributes
- **Element Primitives**: Complete set of HTML element builders
- **Server-Side Focused**: Optimized for server-side rendering scenarios

## Installation

```bash
npm install @onivoro/server-html
```

## Quick Start

```typescript
import { div, h1, p, button } from '@onivoro/server-html';

// Basic element creation
const title = h1(['Welcome to My Site']);
const description = p(['This is a sample paragraph.']);

// Element with attributes and styling
const styledDiv = div([title, description], {
  cssClass: 'container',
  style: {
    'max-width': '800px',
    margin: '0 auto',
    padding: '2rem'
  }
});

// Button with built-in styling
const actionButton = button(['Click Me'], {
  href: '/action',
  style: { 'background-color': '#007bff', color: 'white' }
});

## DOM API Compatibility

Use the familiar $-prefixed element factories from @vanilla-mint/dom for server-side rendering:

```typescript
import { $div, $h1, $p, styled } from '@onivoro/server-html';

const html = $div({
  className: 'container',
  style: { display: 'flex', flexDirection: 'column' },
  children: [
    $h1({ textContent: 'Server-Side Rendering', style: { fontWeight: 700 }}),
    $p({ textContent: 'This markup was generated on the server.' })
  ]
});
```

## Core Concepts

## Core Concepts

### Element Builders

The library provides functional element builders for all common HTML elements:

```typescript
import {
  div, h1, h2, h3, h4, h5, h6, p,
  button, anchor, img, table, thead,
  tbody, tr, th, td, main, header
} from '@onivoro/server-html';

// All elements follow the same pattern:
// elementName(content, attributes?)
const heading = h1(['Page Title']);
const paragraph = p(['Some content'], { cssClass: 'lead' });
```

### Attributes and Styling

```typescript
import { div } from '@onivoro/server-html';

const styledElement = div(['Content'], {
  // CSS class
  cssClass: 'my-class',

  // Inline styles
  style: {
    'background-color': '#f8f9fa',
    padding: '1rem',
    'border-radius': '4px'
  },

  // Custom attributes
  id: 'unique-id',
  'data-testid': 'test-element'
});
```

## Email Templates

### Email Body Component

Create structured email templates with headers and content:

```typescript
import { emailBody } from '@onivoro/server-html';

const email = emailBody(
  'Welcome!',                    // title
  'Thanks for joining us',       // subtitle
  [                             // content markup
    '<p>We\'re excited to have you on board.</p>',
    '<p>Get started by exploring our features.</p>'
  ],
  'https://example.com/logo.png', // optional logo URL
  {                              // optional extra styles
    'background-color': '#ffffff',
    'font-family': 'Arial, sans-serif'
  }
);
```

### Data Tables

Generate HTML tables with automatic styling:

```typescript
import { table } from '@onivoro/server-html';

const dataTable = table(
  ['Name', 'Email', 'Role'],     // columns
  [                              // rows
    ['John Doe', 'john@example.com', 'Admin'],
    ['Jane Smith', 'jane@example.com', 'User'],
    ['Bob Johnson', 'bob@example.com', 'Editor']
  ]
);
```

## Styling Utilities

### Pre-built Styles

```typescript
import { buttonStyles, fontStyles } from '@onivoro/server-html';

// buttonStyles includes:
// - padding, border, border-radius
// - font-weight, text-align
// - display and box-sizing

// fontStyles includes:
// - font-family and other typography settings
```

### Inline Style Helpers

```typescript
import { inlineStyle, formatAttributes } from '@onivoro/server-html';

// Convert style object to inline style string
const styleString = inlineStyle({
  'font-size': '16px',
  color: '#333'
});
// Result: 'style="font-size:16px;color:#333"'

// Format attributes for HTML
const attrString = formatAttributes({
  id: 'my-id',
  'data-value': '123'
});
// Result: 'id="my-id" data-value="123"'
```

## Advanced Usage

### Custom Element Creation

```typescript
import { element, selfClosingElement } from '@onivoro/server-html';

// Create custom elements
const customElement = element('custom-tag', ['content'], {
  'custom-attr': 'value'
});

// Create self-closing elements
const input = selfClosingElement('input', {
  type: 'text',
  name: 'username'
});
```

### Complex Layouts

```typescript
import { div, header, main, h1, p, button } from '@onivoro/server-html';

const pageLayout = div([
  header([
    h1(['My Application']),
  ], { cssClass: 'header' }),

  main([
    div([
      h1(['Welcome']),
      p(['This is the main content area.']),
      button(['Get Started'], {
        style: { 'background-color': '#28a745', color: 'white' }
      })
    ], { cssClass: 'content' })
  ], { cssClass: 'main' })
], { cssClass: 'page-wrapper' });
```

## API Reference

### Element Builders

| Function | Description | Usage |
|----------|-------------|--------|
| `div(content, attrs?)` | Create a div element | `div(['content'])` |
| `h1-h6(content, attrs?)` | Create heading elements | `h1(['Title'])` |
| `p(content, attrs?)` | Create paragraph | `p(['Text'])` |
| `button(content, attrs?)` | Create button with built-in styles | `button(['Click'])` |
| `anchor(content, attrs?)` | Create anchor with button styles | `anchor(['Link'])` |
| `img(attrs)` | Create image element | `img({ src: 'url' })` |

### Table Elements

| Function | Description |
|----------|-------------|
| `tab(content, attrs?)` | Table wrapper |
| `thead(content, attrs?)` | Table header |
| `tbody(content, attrs?)` | Table body |
| `tr(content, attrs?)` | Table row |
| `th(content, attrs?)` | Table header cell |
| `td(content, attrs?)` | Table data cell |

### Utilities

| Function | Description |
|----------|-------------|
| `emailBody(title, subtitle, content, logo?, styles?)` | Email template |
| `table(columns, rows)` | Data table generator |
| `formatAttributes(attrs)` | Format HTML attributes |
| `inlineStyle(styles)` | Convert style object to string |

## Type Definitions

```typescript
type TAttributes = Record<string, any> & {
  cssClass?: string;
  style?: Record<string, string>;
};

type TElementRenderer = (
  content: Array<string | number>,
  attributes?: TAttributes
) => string;

type TSelfClosingElementRenderer = (
  attributes?: TAttributes
) => string;
```

## Contributing

This package is part of the Onivoro monorepo. Please refer to the main repository for contribution guidelines.

## License

This library is licensed under the MIT License. See the LICENSE file in this package for details.
