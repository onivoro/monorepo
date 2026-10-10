# @onivoro/browser-agentic-mui

MUI components for
[`@onivoro/browser-agentic`](https://www.npmjs.com/package/@onivoro/browser-agentic):
a conversation page, a streaming message surface, and a contextual drawer that
opens a conversation about whatever record the user is looking at.

The state, wire and addressing live in the headless package. This one is the UI —
take it if you already use MUI, or build your own against the same hook if you
don't.

## Installation

```bash
npm install @onivoro/browser-agentic-mui @onivoro/browser-agentic @onivoro/isomorphic-agentic \
  @mui/material @mui/icons-material @emotion/react @emotion/styled \
  react-markdown remark-gfm
```

Components render through your existing MUI theme — no palette, no overrides,
nothing to reconcile with a design system you already have. Labels are English,
and the default heading and button label is `iGENTiC`.

The examples below assume an adapter from the headless package:

```ts
import { createBrowserAgenticChatAdapter } from '@onivoro/browser-agentic';

const agentic = createBrowserAgenticChatAdapter({ apiBaseUrl: '', mcpAuthorizationHeaderName: 'X-Mcp-Authorization', useEventStream });
const { useAgenticChat } = agentic;
```

## AgenticChatPageShell

A full conversation page: history sidebar (search, new chat, delete with
confirmation; hidden below the `md` breakpoint), composer, starter actions and
prompt library.

```tsx
import { buildAgenticConversationPath } from '@onivoro/browser-agentic';
import { AgenticChatPageShell } from '@onivoro/browser-agentic-mui';

<AgenticChatPageShell heading="Assistant" conversationId={params.conversationId} buildConversationPath={(id) => buildAgenticConversationPath('/assistant', id)} navigate={navigate} localStorageKey="acme-agentic-conversation-id" useAgenticChat={useAgenticChat} listConversations={agentic.listAgenticConversations} createConversation={agentic.createAgenticConversation} deleteConversation={agentic.deleteAgenticConversation} ensureConversation={agentic.ensureAgenticConversation} promptLibrary={agentic.promptLibrary} starterActions={starters} />;
```

Routing is injected rather than assumed: give it `navigate` and a one-argument
path builder and it works under any router. Pass memoized callbacks — the
bootstrap effect re-runs when they change identity.

On mount it opens the route's conversation (via `ensureConversation`), else the
id stored under `localStorageKey` (dropping it on a 404), else a new one, and
replaces the route to match. Deleting the open conversation starts a new one.
The list is fetched 50 at a time and refreshed after each send. The open
conversation stays in the list even when it is not among those 50; a search
shows only the matching results. A conversation
whose metadata has a string `workflowLabel` shows it under the heading.
`pageShell` wraps the content in your own layout.

## AgenticChatSurface

The messages themselves — streaming text, reasoning, tool calls with their
arguments and results, errors — plus the header, composer, starter actions and
prompt library. Assistant text renders as markdown through `react-markdown`
with GFM; text that parses as a JSON object or array renders as a payload block.
Tool-role messages are not shown on their own; their results attach to the
matching tool call. Use it directly to put a conversation somewhere that is not
a page:

```tsx
import { AgenticChatSurface } from '@onivoro/browser-agentic-mui';

const chat = useAgenticChat(conversationId);

<AgenticChatSurface conversationId={conversationId} messages={chat.messages} onSend={chat.sendMessage} isConnected={chat.isConnected} isLoading={chat.isLoading} isSending={chat.isSending} error={chat.error} heading="Assistant" starterActions={starters} />;
```

Optional props: `heading`, `subheading` (a node), `error`, `promptLibrary`,
`starterActions` and `resourceContext`. With `resourceContext`, every send
carries `resourceContextMetadata(resourceContext)` as message metadata. The
connection chip reads `Connected` or `Reconnecting` from `isConnected`, so it
shows `Reconnecting` permanently when no event stream is configured.

### Starter actions

`AgenticStarterAction`s from the headless package render as cards while the
conversation is empty, each sending its prompt in one click. An action with
`inputs` shows those fields on its card and stays disabled until the required
ones are filled; filled inputs are appended to the prompt as a
`Workflow inputs:` list, and the send's metadata is
`{ ...action.metadata, workflowInputs }`.

```ts
import type { AgenticStarterAction } from '@onivoro/browser-agentic';

const starters: AgenticStarterAction[] = [
  { label: 'Summarize', prompt: 'Summarize this invoice.' },
  {
    label: 'Draft reminder',
    prompt: 'Draft a payment reminder.',
    inputs: [{ name: 'tone', label: 'Tone', defaultValue: 'polite', required: true }],
  },
];
```

### Prompt library

With a `promptLibrary` (`AgenticPromptLibraryClient`, e.g. `agentic.promptLibrary`)
the composer gets a library dialog to search, create, edit and delete saved
prompts, fill their `{{parameters}}`, and insert the rendered text into the
draft.

## ResourceAgentDrawer

A right-hand drawer anchored to a record, opening _the_ conversation for that
record:

```tsx
import { ResourceAgentDrawer } from '@onivoro/browser-agentic-mui';

<ResourceAgentDrawer open={open} onClose={close} appNamespace="acme" resourceContext={{ resourceType: 'invoice', resourceId: invoice.id, label: `Invoice ${invoice.number}`, identifiers: { invoiceId: invoice.id } }} useAgenticChat={useAgenticChat} ensureConversation={agentic.ensureAgenticConversation} />;
```

The conversation id is `agenticResourceConversationId(appNamespace,
resourceType, resourceId)` unless you pass `conversationId`, so the same record
always reopens the same conversation. When opened, the drawer calls
`ensureConversation` with that id, the record's `resourceContextMetadata` and a
title (`title` or the context's `label`) before showing the chat, and every send
carries the same metadata — which is what lets server-side tools fill their
arguments without the model restating an id it was never shown. The header
lists the record's identifiers as chips.

Other props: `title`, `promptLibrary`, `starterActions`, and
`defaultStarterActions(resourceContext)` used when `starterActions` is absent.

`AgenticChatResourceButton` is the matching trigger: a button that opens the
drawer, rendered only when `canUseAgenticChat()` returns true. It takes the
drawer's props (minus `open` / `onClose`) plus `label` (default `iGENTiC`),
`size` (default `small`) and `variant` (default `outlined`):

```tsx
<AgenticChatResourceButton appNamespace="acme" canUseAgenticChat={() => user.canUseAssistant} resourceContext={{ resourceType: 'invoice', resourceId: invoice.id }} useAgenticChat={useAgenticChat} ensureConversation={agentic.ensureAgenticConversation} />
```

## McpToolCatalogPageShell / McpToolCatalogFetchPage

Render the tool catalogue HTML a server exposes (for example from
`McpToolCatalogService` in `@onivoro/server-agentic-mcp`) in an `iframe`
via `srcDoc`, so users can see what the agent can actually do.

The shell takes a loader you already have; the fetch page `fetch`es `endpoint`
and expects a JSON body of `{ value: '<html>' }`:

```tsx
import { McpToolCatalogFetchPage, McpToolCatalogPageShell } from '@onivoro/browser-agentic-mui';

<McpToolCatalogFetchPage endpoint="/api/mcp-tools" errorLabel="Failed to load tools" />

<McpToolCatalogPageShell loadHtml={loadCatalogHtml} />
```

`loadHtml` (and the fetch page's `fetchOptions`) must be stable — memoize them,
since they are effect dependencies and a new identity refetches. Both accept
`iframeTitle`, `loadingLabel` and `pageShell`; the fetch page also takes
`fetchOptions`, and reports a non-2xx response as `` `${errorLabel}: ${status}` ``.

## Testing components that import this

`react-markdown` and `remark-gfm` are ESM and will not parse under a CommonJS
jest preset. They are reached transitively — the drawer imports the surface,
which renders markdown — so a spec that never renders a message still trips over
them. Map them to a stub in your own project:

```js
// src/test/esm-stub.js
module.exports = function EsmStub({ children }) {
  return children ?? null;
};
module.exports.default = module.exports;
```

```ts
moduleNameMapper: {
  '^react-markdown$': '<rootDir>/src/test/esm-stub.js',
  '^remark-gfm$': '<rootDir>/src/test/esm-stub.js',
}
```

A spec that genuinely needs real markdown rendering should drop the mapping for
itself rather than work around it.

## License

MIT
