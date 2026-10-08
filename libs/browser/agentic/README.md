# @onivoro/browser-agentic

The browser half of
[`@onivoro/server-agentic`](https://www.npmjs.com/package/@onivoro/server-agentic):
a typed fetch client, a hook that folds a live event stream into conversation
state, and a seam for whatever transport delivers those events.

**Headless.** No components, no styling, no opinion about how a chat looks —
only the state and the wire. Bring your own UI, or use
[`@onivoro/browser-agentic-mui`](https://www.npmjs.com/package/@onivoro/browser-agentic-mui).

## Installation

```bash
npm install @onivoro/browser-agentic @onivoro/isomorphic-agentic react
```

## The adapter

`createBrowserAgenticChatAdapter` assembles the client, the prompt library and
the hook from one config, so an application wires its URL and auth headers once:

```ts
import { createBrowserAgenticChatAdapter } from '@onivoro/browser-agentic';

export const agentic = createBrowserAgenticChatAdapter({
  apiBaseUrl: '', // same origin; requests go to /api/agentic-chat/...
  getAuthorizationHeader: () => `Bearer ${token()}`,
  getMcpAuthorizationHeader: () => mcpToken(),
  mcpAuthorizationHeaderName: 'X-Mcp-Authorization',
  useEventStream,
});

export const useAgenticChat = agentic.useAgenticChat;
```

| Option                       | Notes                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `apiBaseUrl`                 | String or function. A trailing `/api` is normalized, then `/api` is appended.   |
| `credentials`                | Passed to `fetch` (`'include'` for cookie auth).                                |
| `getAuthorizationHeader`     | Sent as `Authorization` on every request when it returns a value.               |
| `getMcpAuthorizationHeader`  | Sent under `mcpAuthorizationHeaderName` on **POST** requests only (i.e. sends). |
| `mcpAuthorizationHeaderName` | Required header name for the above.                                             |
| `useEventStream`             | The transport hook; see below. Optional.                                        |

The adapter exposes every client method (`listAgenticConversations`,
`createAgenticConversation`, `ensureAgenticConversation`,
`getAgenticConversation`, `deleteAgenticConversation`, the prompt methods,
`agenticFetch`, `agenticMessagesUrl`), the raw `agenticClient`, a
`promptLibrary` (`AgenticPromptLibraryClient`: `listPrompts`, `createPrompt`,
`updatePrompt`, `deletePrompt`) and the bound `useAgenticChat` hook.

## The hook

```ts
const {
  conversationId,
  messages, // AgenticMessage[], current state of the conversation
  sendMessage, // (text, metadata?) => Promise<void>
  reload, // () => Promise<void>, refetch messages over HTTP
  isConnected, // whatever the event stream reports
  isLoading, // a message fetch is in flight
  isSending,
  error, // last error message, if any
} = useAgenticChat(conversationId);
```

Messages load over HTTP when the conversation id changes, and again after every
send; between those the event stream keeps them current. Both paths feed the
same reducer (`reduceAgenticEvent` from the isomorphic package), so a delta
arriving mid-stream and a message read back from storage converge on the same
state. `sendMessage` trims its text and ignores an empty string.

Without the adapter, bind the hook to a client yourself:

```ts
import { createAgenticChatClient, createUseAgenticChat } from '@onivoro/browser-agentic';

const client = createAgenticChatClient({ apiBaseUrl: '' });
const useAgenticChat = createUseAgenticChat({ client, useEventStream });
```

`useConfiguredAgenticChat(conversationId, { client, useEventStream })` is the
same hook with its config passed per call.

## Transport is yours

The package streams nothing by itself. Supply a `UseAgenticEventStream` — a
hook, because every real implementation needs state of its own. It receives the
conversation id and an `onEvent` callback, and returns `{ isConnected }`:

```ts
import { useEffect, useState } from 'react';
import type { UseAgenticEventStream } from '@onivoro/browser-agentic';

// The endpoint is the host's own; the server packages do not ship one.
const useEventStream: UseAgenticEventStream = (conversationId, onEvent) => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const source = new EventSource(`/api/acme/agentic-events/${encodeURIComponent(conversationId)}`);
    source.onopen = () => setIsConnected(true);
    source.onerror = () => setIsConnected(false);
    source.onmessage = (e) => onEvent(JSON.parse(e.data));
    return () => source.close();
  }, [conversationId, onEvent]);

  return { isConnected };
};
```

A websocket version subscribes to a room instead; long-polling works too. The
chat does not know which, and adding a transport does not change this package.

> **It must be referentially stable.** It is called as a hook on every render,
> so define it at module scope or memoize it. Swapping implementations between
> renders breaks the rules of hooks.

Omit it entirely and the chat still loads and sends over HTTP — it simply never
streams, and reports `isConnected: false`, which is the truth rather than a
pretence. That default is exported as `useNoAgenticEventStream`.

## The fetch client

`createAgenticChatClient(config)` returns an `AgenticChatClient`. Config is
`AgenticChatClientConfig`: `apiBaseUrl`, `credentials`, and two header
providers, `authHeaders` (every request) and `extraSendHeaders` (POST only),
each `(init) => HeadersInit | Promise<HeadersInit>`.

It expects these routes under `<apiBaseUrl>/api/agentic-chat`, which the host
server implements (the prompt routes match `AgenticPromptLibraryController` in
`@onivoro/server-agentic`):

| Method                      | Request                                                          |
| --------------------------- | ---------------------------------------------------------------- |
| `listAgenticConversations`  | `GET conversations?limit&q&resourceId&resourceType`              |
| `createAgenticConversation` | `POST conversations` with `{ id?, title?, metadata? }`           |
| `getAgenticConversation`    | `GET conversations/:id`                                          |
| `deleteAgenticConversation` | `DELETE conversations/:id`                                       |
| `ensureAgenticConversation` | GET, then POST on 404, then GET again on a 409 race              |
| `listAgenticMessages`       | `GET conversations/:id/messages`                                 |
| (hook) `sendMessage`        | `POST conversations/:id/messages` with `{ text, metadata }`      |
| `listAgenticPrompts`        | `GET prompts?limit&q`                                            |
| `createAgenticPrompt`       | `POST prompts`                                                   |
| `updateAgenticPrompt`       | `POST prompts/:id`                                               |
| `deleteAgenticPrompt`       | `DELETE prompts/:id`                                             |
| `renderAgenticPrompt`       | `POST prompts/:id/render` with `{ values }` → `{ prompt, text }` |

`agenticFetch<T>(url, init?)` is the shared request function: it adds the
headers, sets `Content-Type: application/json` when there is a body, uses
`cache: 'no-store'`, returns `undefined` for a 204, and refuses any URL outside
the configured API base. A non-2xx response throws `AgenticFetchError`, whose
`status` carries the HTTP status and whose message is the body's `message`
field when there is one:

```ts
import { AgenticFetchError, isAgenticFetchStatus } from '@onivoro/browser-agentic';

try {
  await agentic.getAgenticConversation(id);
} catch (error) {
  if (isAgenticFetchStatus(error, 404)) return undefined;
  throw error;
}
```

## Addressable conversations

`agenticResourceConversationId(appNamespace, resourceType, resourceId)` builds a
deterministic conversation id from a record, and
`scopedAgenticResourceConversationId(..., scope)` appends one more segment.
Each segment has characters outside `[A-Za-z0-9_.-]` replaced with `_`:

```ts
import { agenticResourceConversationId, buildAgenticConversationPath, resourceContextMetadata } from '@onivoro/browser-agentic';

agenticResourceConversationId('acme', 'invoice', 1234); // 'acme:invoice:1234'

resourceContextMetadata({
  resourceType: 'invoice',
  resourceId: 1234,
  label: 'Invoice 1234',
  identifiers: { invoiceId: 1234, customerId: 'c-9' },
});
// { invoiceId: 1234, customerId: 'c-9', identifiers: { invoiceId: 1234, customerId: 'c-9' },
//   resourceId: 1234, resourceLabel: 'Invoice 1234', resourceType: 'invoice' }

buildAgenticConversationPath('/assistant', 'acme:invoice:1234'); // '/assistant/acme%3Ainvoice%3A1234'
```

`resourceContextMetadata` takes an `AgenticChatResourceContext` and spreads its
`metadata`, then its identifiers (both flattened and under `identifiers`), then
`resourceId`, `resourceLabel` and `resourceType`, dropping `undefined` values.

Together they mean a drawer opened on the same record always lands in the same
conversation, and that the tools called inside it can be handed the record's
identifiers without the model restating them. Whether every user shares that
conversation is the server's decision: `@onivoro/server-agentic`'s lifecycle
service lets any user open a conversation whose metadata carries `resourceType`
and `resourceId`.

## Other types

- `AgenticStarterAction` / `AgenticStarterInput` — canned prompts with optional
  input fields, consumed by the MUI components.
- `AgenticConversationRouteConfig` — the routing props a conversation page needs
  (`buildConversationPath`, `conversationId`, `localStorageKey`, `navigate`).
- `ListAgenticConversationsOptions`, `CreateAgenticConversationInput`,
  `AgenticAuthHeadersProvider`, `BrowserAgenticChatAdapterConfig`,
  `BrowserAgenticChatAdapter`, `UseAgenticChatConfig`, `UseAgenticChatResult`,
  `AgenticEventStream`.

## License

MIT
