# @onivoro/isomorphic-agentic

The shared contract for an agentic chat system: the message model, the streaming
event unions, and the interfaces that let a server implementation and a browser
client agree on both.

Types and pure functions only — no framework and no runtime dependencies beyond
`tslib`. The server packages implement these interfaces; the browser packages
consume the same types and replay the same events.

## Installation

```bash
npm install @onivoro/isomorphic-agentic
```

## The message model

A conversation holds messages; a message holds parts. Parts are what stream.

```ts
import { AgenticMessage, AgenticPart } from '@onivoro/isomorphic-agentic';
```

| Part type     | Interface               | Carries                                                 |
| ------------- | ----------------------- | ------------------------------------------------------- |
| `text`        | `AgenticTextPart`       | assistant or user prose                                 |
| `reasoning`   | `AgenticReasoningPart`  | model reasoning, when the provider exposes it           |
| `tool-call`   | `AgenticToolCallPart`   | `toolCallId`, tool name, streamed `inputText`, `input`  |
| `tool-result` | `AgenticToolResultPart` | `result`, its `resultText` rendering, an `isError` flag |
| `file`        | `AgenticFilePart`       | name, MIME type, size, `uri` or inline `data`           |
| `approval`    | `AgenticApprovalPart`   | an action and whether it was approved                   |
| `error`       | `AgenticErrorPart`      | a failure surfaced into the transcript                  |
| `summary`     | `AgenticSummaryPart`    | compacted text and the ids of the messages it replaces  |

Every part has an `id` and an optional `status` (`pending`, `streaming`,
`running`, `complete`, `error`, `aborted`). Streaming deltas append to one of
three string fields, `AgenticDeltaField`: `text`, `inputText` or `resultText`.

Roles (`AgenticRole`) are `system`, `user`, `assistant`, `tool` and `summary`.
Message status is `pending`, `streaming`, `complete`, `error` or `aborted`.

A run (`AgenticRun`) is one turn of the loop: the user message that started it,
the assistant message it produced, model and provider, token usage
(`AgenticUsage`) and a status (`queued`, `running`, `complete`, `error`,
`aborted`). Conversations (`AgenticConversation`) are `active`, `archived` or
`deleted`, and carry `participantIds` and free-form `metadata`.
`AgenticConversationListItem` adds `messageCount`, `lastMessageAt` and
`preview` for history lists.

## The provider seams

Two interfaces are all a host application has to supply:

```ts
interface AgenticModelProvider {
  readonly provider: string;
  readonly model: string;
  stream(request: AgenticModelRequest): AsyncIterable<AgenticModelEvent>;
  complete?(request: AgenticModelRequest): Promise<AgenticMessage>;
}

interface AgenticToolProvider {
  listTools(context: AgenticToolExecutionContext): Promise<AgenticToolDefinition[]>;
  executeTool(call: AgenticToolCall, context: AgenticToolExecutionContext): Promise<AgenticToolExecutionResult>;
}
```

`AgenticModelRequest` carries the conversation and run ids, the `messages`, an
optional `system` prompt, `tools`, `model`, `temperature`, `maxTokens`,
`stepIndex`, an abort `signal` and `metadata`.
`AgenticToolExecutionContext` carries the ids, `userId`, `sessionId`, an opaque
`authInfo`, the abort `signal`, conversation `metadata`, and optional
`sendProgress` / `sendLog` channels.

Everything downstream speaks `AgenticModelEvent`, so a provider's job is to
normalize one vendor's stream into that union and nothing else:

```
step-start / step-finish / finish
text-start / text-delta / text-end
reasoning-start / reasoning-delta / reasoning-end
tool-input-start / tool-input-delta / tool-input-end
tool-call / tool-result / tool-error
provider-error
```

`step-finish` and `finish` carry an `AgenticFinishReason` (`stop`, `length`,
`tool-calls`, `content-filter`, `error`, `abort`, `unknown`) and optional usage.
Adding a model means writing one adapter, not touching the loop.

A minimal provider:

```ts
import { AgenticModelEvent, AgenticModelProvider, AgenticModelRequest } from '@onivoro/isomorphic-agentic';

export class EchoModelProvider implements AgenticModelProvider {
  readonly provider = 'echo';
  readonly model = 'echo-1';

  async *stream(request: AgenticModelRequest): AsyncIterable<AgenticModelEvent> {
    const last = request.messages[request.messages.length - 1];
    const text = last?.parts.map((part) => (part.type === 'text' ? part.text : '')).join('') ?? '';

    yield { type: 'step-start', index: request.stepIndex ?? 0 };
    yield { type: 'text-start', id: 'text-0' };
    yield { type: 'text-delta', id: 'text-0', text };
    yield { type: 'text-end', id: 'text-0' };
    yield { type: 'step-finish', index: request.stepIndex ?? 0, reason: 'stop' };
    yield { type: 'finish', reason: 'stop' };
  }
}
```

### Streaming tool arguments

`AgenticToolArgumentStream<TKey>` is for provider authors. Vendors stream tool
arguments as partial JSON keyed by a block or choice index; this tracks each
pending call by that key and returns the normalized events to emit:

```ts
import { AgenticToolArgumentStream } from '@onivoro/isomorphic-agentic';

const tools = new AgenticToolArgumentStream<number>();

tools.start(0, { id: 'toolu_1', name: 'lookup' }).events; // [tool-input-start]
tools.appendExisting(0, '{"id":').events; // [tool-input-delta]
tools.appendExisting(0, '42}').events; // [tool-input-delta]
tools.finish(0).events; // [tool-input-end, tool-call { input: { id: 42 } }]
```

`appendOrStart` starts the call on its first delta when the vendor does not send
a separate start; `finishAll` closes everything still open at the end of a
stream. A delta with no known call produces a `provider-error` event instead of
throwing.

`parseToolInput(text)` is the parser `finish` uses: empty input becomes `{}`, and
invalid JSON becomes `{ _raw, _parseError }` rather than an exception, so the
loop can report the bad arguments back to the model.

## Replaying events in a browser

The server publishes `AgenticEvent`s — `conversation.upsert`, `message.upsert`,
`message.remove`, `message.part.upsert`, `message.part.delta`, `run.upsert` and
`run.error`. `reduceAgenticEvent` folds them into client state, so a client only
has to deliver events — over websocket, SSE, or anything else — and render the
result.

```ts
import { createEmptyAgenticClientState, reduceAgenticEvent } from '@onivoro/isomorphic-agentic';

let state = createEmptyAgenticClientState();
state = reduceAgenticEvent(state, event);

const messages = state.messagesByConversationId[conversationId] ?? [];
```

`AgenticClientState` holds `messagesByConversationId` and `runsById`. New
messages are kept in chronological order; a delta for a part that has not
arrived yet creates a streaming text part. `conversation.upsert` and `run.error`
leave the state unchanged; handle them yourself if the UI needs them.

`AgenticClientTransport` (`subscribe`, `send`, `abort`) and
`AgenticSendUserInput` describe a client-side transport for hosts that want one
interface over their delivery mechanism.

## Prompt templates

Prompts use `{{parameter}}` placeholders. Parameter names must match
`/^[A-Za-z][A-Za-z0-9_]*$/`.

```ts
import { extractAgenticPromptParameters, renderAgenticPrompt } from '@onivoro/isomorphic-agentic';

const text = 'Summarize invoice {{invoiceId}} for {{customer_name}}.';
const parameters = extractAgenticPromptParameters(text);
// [{ name: 'invoiceId', label: 'Invoice Id', required: true },
//  { name: 'customer_name', label: 'Customer name', required: true }]

renderAgenticPrompt({ prompt: text, parameters }, { invoiceId: '1234', customer_name: 'Acme' });
// 'Summarize invoice 1234 for Acme.'
```

Both throw `AgenticPromptTemplateError` for unbalanced or nested delimiters,
empty or invalid names, or a missing value for a required parameter. The stored
shape is `AgenticPrompt` (owner, title, prompt, parameters, metadata), with
`AgenticPromptCreateInput`, `AgenticPromptUpdateInput` and
`AgenticPromptRenderInput` for the API around it.

## Persistence and transport seams

`AgenticRepositories` describes the storage a loop needs without naming a
database. Only `messages` is required; `conversations`, `runs`, `usage`,
`summaries` and `prompts` are optional:

| Repository                      | Methods                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| `AgenticConversationRepository` | `create`, `get`, `update`, optional `list(AgenticConversationListOptions)`         |
| `AgenticMessageRepository`      | `create`, `update`, `get`, `listByConversationId`, `upsertPart`, `appendPartDelta` |
| `AgenticRunRepository`          | `create`, `update`, `get`                                                          |
| `AgenticUsageRepository`        | `recordMessageUsage`, `recordRunUsage`                                             |
| `AgenticSummaryRepository`      | `getLatest`, `create`                                                              |
| `AgenticPromptRepository`       | `create`, `getForOwner`, `listForOwner`, `updateForOwner`, `deleteForOwner`        |

`AgenticEventPublisher` (`publish`, optional `publishMany`, each with an
`AgenticEventContext`) does the same for delivery. Implement them, or take an
implementation off the shelf
([`@onivoro/server-agentic-typeorm`](https://www.npmjs.com/package/@onivoro/server-agentic-typeorm) for storage).

## Usage arithmetic

`mergeAgenticUsage(first, second)` sums two `AgenticUsage` records field by
field, treating a missing field as absent rather than zero, and returns the other
argument when one is `undefined`.

## Conversation rooms

A websocket transport usually carries each conversation's events in a room named
by an application-owned prefix. These helpers take the app's room factory rather
than hard-coding one:

```ts
import { agenticConversationIdFromRoom, isAgenticConversationRoom } from '@onivoro/isomorphic-agentic';

const roomFor = (conversationId: string) => `acme:agentic:conversation:${conversationId}`;

isAgenticConversationRoom('acme:agentic:conversation:abc', roomFor); // true
agenticConversationIdFromRoom('acme:agentic:conversation:abc', roomFor); // 'abc'
agenticConversationIdFromRoom('acme:other:room', roomFor); // undefined
```

## JSON types

`JsonPrimitive`, `JsonValue`, `JsonObject`, `JsonSchemaObject` and
`AgenticProviderMetadata` type metadata, tool schemas and provider passthrough
data throughout.

## License

MIT
