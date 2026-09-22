# @onivoro/browser-agentic

The browser half of
[`@onivoro/server-agentic`](https://www.npmjs.com/package/@onivoro/server-agentic):
a typed fetch client, a hook that folds a live event stream into conversation
state, and a seam for whatever transport delivers those events.

**Headless.** No components, no styling, no opinion about how a chat looks —
only the state and the wire. Bring your own UI.

## Installation

```bash
npm install @onivoro/browser-agentic @onivoro/isomorphic-agentic react
```

## The hook

```ts
import { createUseAgenticChat } from '@onivoro/browser-agentic';

const useAgenticChat = createUseAgenticChat({ client, useEventStream });
```

```ts
const {
  messages, // AgenticMessage[], newest state of the conversation
  sendMessage, // (text, metadata?) => Promise<void>
  reload,
  isConnected, // is the stream live
  isLoading, // initial fetch in flight
  isSending,
  error,
} = useAgenticChat(conversationId);
```

Messages load once over HTTP, then the event stream keeps them current.
Both paths feed the same reducer (`reduceAgenticEvent` from the isomorphic
package), so a delta arriving mid-stream and a message read back from storage
converge on the same state.

## Transport is yours

The package streams nothing by itself. Supply a `UseAgenticEventStream` — a
hook, because every real implementation needs state of its own:

```ts
const useEventStream: UseAgenticEventStream = (conversationId, onEvent) => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const source = new EventSource(`/api/agentic-chat/${conversationId}/events`);
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
pretence.

## The adapter

`createBrowserAgenticChatAdapter` assembles the client, the prompt library and
the hook from one config, so an application wires URLs and auth headers once:

```ts
const agentic = createBrowserAgenticChatAdapter({
  apiBaseUrl: '/api/agentic-chat',
  getAuthorizationHeader: () => `Bearer ${token()}`,
  mcpAuthorizationHeaderName: 'X-Mcp-Authorization',
  useEventStream,
});
```

## Addressable conversations

`agenticResourceConversationId` (and its scoped variant) builds a deterministic
conversation id from a record, `resourceContextMetadata` packages that record's
identifiers as conversation metadata, and `buildAgenticConversationPath` turns an
id into a route.

Together they mean a drawer opened on the same record always lands in the same
conversation — for every user, in every session — and that the tools called
inside it can be handed the record's identifiers without the model restating
them. The chat becomes a property of the record rather than of the tab.

## License

MIT
