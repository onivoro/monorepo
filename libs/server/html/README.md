# @onivoro/server-html

A TypeScript library for server-side HTML generation with a functional approach. Philosophically similar to JSX except there's no compilation.

## Features

- **Functional HTML Generation**: Create HTML elements using functional composition
- **Type-Safe**: Full TypeScript support with proper type definitions
- **Server-Side Focused**: Optimized for server-side rendering scenarios

## Installation

```bash
npm install @onivoro/server-html
```

## Quick Start

Use the $-prefixed element factories from @vanilla-mint/dom server-side:

```typescript
import { $div, $h1, $p } from '@onivoro/server-html';

const html = $div({
  className: 'container',
  style: { display: 'flex', flexDirection: 'column' },
  children: [
    $h1({ textContent: 'Server-Side Rendering', style: { fontWeight: 700 }}),
    $p({ textContent: 'This markup was generated on the server.' })
  ]
});
```

## Contributing

This package is part of the Onivoro monorepo. Please refer to the main repository for contribution guidelines.

## License

This library is licensed under the MIT License. See the LICENSE file in this package for details.
