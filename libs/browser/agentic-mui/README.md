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
npm install @onivoro/browser-agentic-mui @onivoro/browser-agentic \
  @mui/material @mui/icons-material @emotion/react @emotion/styled \
  react-markdown remark-gfm
```

Components render through your existing MUI theme — no palette, no overrides,
nothing to reconcile with a design system you already have.

## AgenticChatPageShell

A full conversation page: history sidebar, composer, starter actions, prompt
library.

```tsx
<AgenticChatPageShell heading="Assistant" conversationId={params.conversationId} buildConversationPath={buildAgenticConversationPath} navigate={navigate} localStorageKey="acme-agentic-conversation-id" useAgenticChat={useAgenticChat} listConversations={agentic.listAgenticConversations} createConversation={agentic.createAgenticConversation} deleteConversation={agentic.deleteAgenticConversation} ensureConversation={agentic.ensureAgenticConversation} promptLibrary={agentic.promptLibrary} starterActions={starters} />
```

Routing is injected rather than assumed: give it `navigate` and a path builder
and it works under any router.

`AgenticChatResourceButton` is the matching trigger, if you want one.

## AgenticChatSurface

The messages themselves — streaming text, reasoning, tool calls with their
arguments and results, errors. Markdown renders through `react-markdown` with
GFM. Use it directly to put a conversation somewhere that is not a page.

## ResourceAgentDrawer

A drawer anchored to a record, opening _the_ conversation for that record:

```tsx
<ResourceAgentDrawer open={open} onClose={close} appNamespace="acme" resourceContext={{ resourceType: 'invoice', resourceId: invoice.id }} useAgenticChat={useAgenticChat} ensureConversation={agentic.ensureAgenticConversation} />
```

The conversation id is derived from the resource, so the same record always
reopens the same conversation — for every user, in every session — and the
record's identifiers ride along as conversation metadata, which is what lets
server-side tools fill their arguments without the model restating an id it was
never shown.

## McpToolCatalogPageShell / McpToolCatalogFetchPage

Renders the tool catalogue a server exposes, so users can see what the agent can
actually do. The shell takes a catalogue you already have; the fetch page
retrieves it for you.

## Testing components that import this

`react-markdown` and `remark-gfm` are ESM and will not parse under a CommonJS
jest preset. They are reached transitively — the drawer imports the surface,
which renders markdown — so a spec that never renders a message still trips over
them. Map them to a stub:

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
