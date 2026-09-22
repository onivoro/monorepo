# @onivoro/isomorphic-agentic

The shared contract for an agentic chat system: the message model, the streaming
event union, and the interfaces that let a server implementation and a browser
client agree on both.

Types and pure functions only — no dependencies, no runtime, no framework. The
server packages implement these interfaces; the browser packages consume the same
types and replay the same events.

## Installation

```bash
npm install @onivoro/isomorphic-agentic
```

## The message model

A conversation holds messages; a message holds parts. Parts are what stream.

```ts
import { AgenticMessage, AgenticPart } from '@onivoro/isomorphic-agentic';
```

| Part type     | Carries                                           |
| ------------- | ------------------------------------------------- |
| `text`        | assistant or user prose                           |
| `reasoning`   | model reasoning, when the provider exposes it     |
| `tool-call`   | tool name, streamed input text, parsed input      |
| `tool-result` | the result, its text rendering, and an error flag |
| `error`       | a failure surfaced into the transcript            |

Roles are `user`, `assistant`, `tool`, `system` and `summary`. A run
(`AgenticRun`) is one turn of the loop: the user message that started it, the
assistant message it produced, token usage and a terminal status.

## The provider seams

Two interfaces are all a host application has to supply:

```ts
interface AgenticModelProvider {
  readonly provider: string;
  readonly model: string;
  stream(request: AgenticModelRequest): AsyncIterable<AgenticModelEvent>;
}

interface AgenticToolProvider {
  listTools(ctx: AgenticToolExecutionContext): Promise<AgenticToolDefinition[]>;
  executeTool(call: AgenticToolCall, ctx: AgenticToolExecutionContext): Promise<AgenticToolExecutionResult>;
}
```

Everything downstream speaks `AgenticModelEvent`, so a provider's job is to
normalize one vendor's stream into that union and nothing else:

```
text-start / text-delta / text-end
reasoning-start / reasoning-delta / reasoning-end
tool-input-start / tool-input-delta / tool-input-end
tool-call
step-start / step-finish / finish
provider-error
```

Adding a model means writing one adapter, not touching the loop.

## Replaying events in a browser

`reduceAgenticEvent` folds an event stream into conversation state, so a client
only has to deliver events — over websocket, SSE, or anything else — and render
the result.

```ts
import { createEmptyAgenticClientState, reduceAgenticEvent } from '@onivoro/isomorphic-agentic';

let state = createEmptyAgenticClientState();
state = reduceAgenticEvent(state, event);
```

`AgenticToolArgumentStream` accumulates the partial JSON that arrives as
`tool-input-delta`, so a half-streamed tool call can be shown while it is still
being written and parsed once it is complete.

## Persistence and transport seams

`AgenticRepositories` describes the storage a loop needs — conversations,
messages, runs, summaries, prompts, usage — without naming a database.
`AgenticEventPublisher` and the transport interfaces do the same for delivery.
Implement them, or take an implementation off the shelf.

## Addressable conversations

`agenticConversationIdFromRoom` and `isAgenticConversationRoom` work with an
application-supplied room factory, so conversation ids can be deterministic —
`app:invoice:1234:notes` always resolves to the same conversation, for every user
and every session. A chat becomes a property of the record rather than of the tab.

## License

MIT
