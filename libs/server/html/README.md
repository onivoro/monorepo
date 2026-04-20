# @onivoro/server-html

Server-side HTML generation with a JSX-like props interface — without JSX. No compilation step, no transpiler config, no `.tsx` files, no virtual DOM. Just functions that take props and return HTML strings.

This matters when you need to generate HTML from a NestJS controller, a CLI tool, an email service, or any server context where introducing a JSX toolchain would be overkill. The API feels like writing React components, but every call is a pure function that returns a string — composable, testable, and zero-dependency.

All 112 HTML5 elements are covered with proper attribute escaping and typed `CSSProperties` support.

## Installation

```bash
npm install @onivoro/server-html
```

## Usage

Every HTML5 tag has a `$`-prefixed factory function that accepts a props object and returns an HTML string.

```typescript
import { $div, $h1, $p, $button } from '@onivoro/server-html';

const html = $div({
  className: 'card',
  style: { padding: '1rem', border: '1px solid #ccc' },
  children: [
    $h1({ textContent: 'Hello' }),
    $p({ textContent: 'Server-rendered HTML.' }),
    $button({ '@click': 'handleClick()', textContent: 'Click me' })
  ]
});
```

### Props

Every element factory accepts `TElementProps`:

| Prop | Type | Description |
|------|------|-------------|
| `className` | `string` | CSS class(es) |
| `style` | `CSSProperties` | Inline styles (camelCase or kebab-case) |
| `children` | `Array<string \| number>` | Nested content (other elements, text) |
| `textContent` | `string` | Single text node |
| `innerHTML` | `string` | Raw HTML content |
| `[key: string]` | `any` | Any other HTML attribute |

Content precedence: `innerHTML` > `textContent` > `children`.

### Self-Closing Elements

Self-closing tags (`img`, `input`, `meta`, `br`, `hr`, `link`, `source`, `area`, `base`, `col`, `embed`, `track`, `wbr`) render correctly:

```typescript
import { $img, $input, $meta } from '@onivoro/server-html';

$img({ src: '/logo.png', alt: 'Logo', style: { maxWidth: '200px' } })
// <img src="/logo.png" alt="Logo" style="max-width: 200px;"/>

$input({ type: 'text', placeholder: 'Search...', className: 'search-input' })
// <input type="text" placeholder="Search..." class="search-input"/>

$meta({ charset: 'UTF-8' })
// <meta charset="UTF-8"/>
```

## Components

Since every element factory is just a function that returns a string, building reusable components works exactly like React — define a function that accepts props and returns markup. No framework, no class hierarchy, no registration step.

### Defining Components

```typescript
import { $div, $h2, $p, $img, TElementProps, CSSProperties } from '@onivoro/server-html';

// A component is just a function — same mental model as a React functional component
interface CardProps {
  title: string;
  body: string;
  imageUrl?: string;
}

function Card({ title, body, imageUrl }: CardProps): string {
  return $div({
    className: 'card',
    style: cardStyle,
    children: [
      imageUrl ? $img({ src: imageUrl, alt: title, style: { width: '100%' } }) : '',
      $h2({ textContent: title }),
      $p({ textContent: body }),
    ]
  });
}

const cardStyle: CSSProperties = {
  border: '1px solid #e0e0e0',
  borderRadius: '8px',
  padding: '1rem',
  maxWidth: '320px',
};
```

### Composing Components

Components compose exactly like React — call them inside `children` arrays:

```typescript
import { $div, $h1 } from '@onivoro/server-html';

function CardGrid(cards: CardProps[]): string {
  return $div({
    children: [
      $h1({ textContent: 'Featured' }),
      $div({
        style: { display: 'flex', gap: '1rem', flexWrap: 'wrap' },
        children: cards.map(card => Card(card)),
      }),
    ]
  });
}

// Usage
const html = CardGrid([
  { title: 'First', body: 'Hello world' },
  { title: 'Second', body: 'Another card', imageUrl: '/img/photo.jpg' },
]);
```

### Components with Children

Accept `children` as a prop to create layout components — the same pattern as `props.children` in React:

```typescript
import { $div, $header, $main, $footer, $h1, CSSProperties } from '@onivoro/server-html';

function PageLayout({ title, children }: { title: string; children: string[] }): string {
  return $div({
    children: [
      $header({ children: [$h1({ textContent: title })] }),
      $main({ style: mainStyle, children }),
      $footer({ textContent: `© ${new Date().getFullYear()}` }),
    ]
  });
}

const mainStyle: CSSProperties = { padding: '2rem', maxWidth: '960px', margin: '0 auto' };
```

## Styles and Scripts as Variables

Styles and scripts are just strings and objects — assign them to variables, share them across components, compose them. No special API needed.

### Shared Styles

```typescript
import { CSSProperties } from '@onivoro/server-html';

// Define once, reference everywhere — like a theme object in React
const theme = {
  primary: { backgroundColor: '#1976d2', color: '#fff' } as CSSProperties,
  surface: { backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' } as CSSProperties,
  text: { fontFamily: 'system-ui, sans-serif', lineHeight: '1.6' } as CSSProperties,
};

// Compose styles with spread — like sx prop merging in MUI
const heroStyle: CSSProperties = { ...theme.primary, padding: '4rem 2rem', textAlign: 'center' };
```

### Inline Scripts

```typescript
import { $script, $style } from '@onivoro/server-html';

// Scripts are just strings — define them as constants alongside the components that use them
const analyticsScript = `
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
`;

const globalStyles = `
  * { box-sizing: border-box; margin: 0; }
  body { font-family: system-ui, sans-serif; }
  .container { max-width: 1200px; margin: 0 auto; padding: 0 1rem; }
`;

// Then inject them into the page
$script({ textContent: analyticsScript });
$style({ textContent: globalStyles });
```

### Putting It Together

```typescript
import { $html, $head, $meta, $title, $style, $script, $body, $div, $h1 } from '@onivoro/server-html';

function renderPage(pageTitle: string, content: string[]): string {
  return $html({
    lang: 'en',
    children: [
      $head({
        children: [
          $meta({ charset: 'UTF-8' }),
          $meta({ name: 'viewport', content: 'width=device-width, initial-scale=1.0' }),
          $title({ textContent: pageTitle }),
          $style({ textContent: globalStyles }),
        ]
      }),
      $body({
        children: [
          $div({ className: 'container', children: content }),
          $script({ textContent: analyticsScript }),
        ]
      })
    ]
  });
}
```

## Dynamic Content

```typescript
import { $ul, $li, $table, $thead, $tbody, $tr, $th, $td } from '@onivoro/server-html';

// Lists — same as items.map() in React JSX
const items = ['Apple', 'Banana', 'Orange'];
const list = $ul({
  children: items.map(textContent => $li({ textContent }))
});

// Tables from data
interface User { name: string; email: string; role: string }
function UserTable(users: User[]): string {
  return $table({
    children: [
      $thead({ children: [$tr({ children: [
        $th({ textContent: 'Name' }),
        $th({ textContent: 'Email' }),
        $th({ textContent: 'Role' }),
      ]})] }),
      $tbody({ children: users.map(u => $tr({ children: [
        $td({ textContent: u.name }),
        $td({ textContent: u.email }),
        $td({ textContent: u.role }),
      ]})) }),
    ]
  });
}
```

## Server-Rendered Pages with Client Interactivity

The props interface accepts arbitrary attributes, making it natural to pair with lightweight client frameworks like Alpine.js. Server-render the structure, let the client handle behavior:

```typescript
import { $div, $button, $input, $ul } from '@onivoro/server-html';

const searchPage = $div({
  'x-data': '{ query: "", results: [] }',
  children: [
    $input({
      type: 'text',
      'x-model': 'query',
      '@input.debounce.300ms': 'search()',
      placeholder: 'Search...'
    }),
    $ul({
      'x-html': 'resultsHtml'
    }),
    $button({
      '@click': 'clearResults()',
      'x-show': 'results.length > 0',
      textContent: 'Clear'
    })
  ]
});
```

No template literals, no string concatenation, no forgetting to escape an attribute value. The same pattern works with HTMX, Stimulus, or any attribute-driven framework.

## Custom Element Factories

Use `asElementFactory` to create factories for custom elements or web components:

```typescript
import { asElementFactory } from '@onivoro/server-html';

// Provide a renderer function: (content: Array<string|number>, attrs: TAttributes) => string
// The easiest approach is to build on an existing element factory
import { $div } from '@onivoro/server-html';

// Semantic wrapper — same as aliasing a styled component in React
const $card = (props: { title: string; children?: string[] }) =>
  $div({
    className: 'card',
    children: [
      $div({ className: 'card-title', textContent: props.title }),
      ...(props.children || []),
    ]
  });

$card({ title: 'Hello', children: ['<p>Content</p>'] });
```

## Available Elements

All HTML5 tags are available as `$`-prefixed exports:

`$a`, `$abbr`, `$address`, `$area`, `$article`, `$aside`, `$audio`, `$b`, `$base`, `$bdi`, `$bdo`, `$blockquote`, `$body`, `$br`, `$button`, `$canvas`, `$caption`, `$cite`, `$code`, `$col`, `$colgroup`, `$data`, `$datalist`, `$dd`, `$del`, `$details`, `$dfn`, `$dialog`, `$div`, `$dl`, `$dt`, `$em`, `$embed`, `$fieldset`, `$figcaption`, `$figure`, `$footer`, `$form`, `$h1`–`$h6`, `$head`, `$header`, `$hgroup`, `$hr`, `$html`, `$i`, `$iframe`, `$img`, `$input`, `$ins`, `$kbd`, `$label`, `$legend`, `$li`, `$link`, `$main`, `$map`, `$mark`, `$math`, `$menu`, `$meta`, `$meter`, `$nav`, `$noscript`, `$object`, `$ol`, `$optgroup`, `$option`, `$output`, `$p`, `$picture`, `$pre`, `$progress`, `$q`, `$rp`, `$rt`, `$ruby`, `$s`, `$samp`, `$script`, `$section`, `$select`, `$slot`, `$small`, `$source`, `$span`, `$strong`, `$style`, `$sub`, `$summary`, `$sup`, `$table`, `$tbody`, `$td`, `$template`, `$textarea`, `$tfoot`, `$th`, `$thead`, `$time`, `$title`, `$tr`, `$track`, `$u`, `$ul`, `$var`, `$video`, `$wbr`

Also exported: `CSSProperties`, `TElementProps`, `asElementFactory`.

## License

MIT
