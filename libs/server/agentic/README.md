# @onivoro/server-agentic

The agentic chat run loop for NestJS: multi-step model turns, every streamed part
persisted and published as it arrives, and tool execution with per-call timeout and
abort.

Implements the interfaces in
[`@onivoro/isomorphic-agentic`](https://www.npmjs.com/package/@onivoro/isomorphic-agentic).
Bring a model provider, a tool provider and somewhere to store messages; this
supplies the loop between them.

## Installation

```bash
npm install @onivoro/server-agentic @onivoro/isomorphic-agentic
```

## Wiring

Everything environmental is a token, so the loop is testable with fakes and no
network:

| Token                     | Supplies                                        | Required |
| ------------------------- | ----------------------------------------------- | -------- |
| `AGENTIC_REPOSITORIES`    | conversations, messages, runs, summaries, usage | yes      |
| `AGENTIC_MODEL_PROVIDER`  | the streaming model                             | yes      |
| `AGENTIC_TOOL_PROVIDER`   | tool discovery and execution                    | no       |
| `AGENTIC_EVENT_PUBLISHER` | delivery to clients (defaults to a no-op)       | no       |
| `AGENTIC_ID_GENERATOR`    | id minting (defaults to `randomUUID`)           | no       |
| `AGENTIC_CHAT_CONFIG`     | step ceiling, timeouts, default system prompt   | no       |

```ts
import { AgenticChatModule, AGENTIC_MODEL_PROVIDER, AGENTIC_REPOSITORIES, AGENTIC_TOOL_PROVIDER } from '@onivoro/server-agentic';

AgenticChatModule.configure({
  config: {
    maxModelSteps: 12,
    toolExecutionTimeoutMs: 120_000,
    defaultSystemPrompt: SYSTEM_PROMPT,
  },
  providers: [
    { provide: AGENTIC_REPOSITORIES, useExisting: MyRepositories },
    { provide: AGENTIC_MODEL_PROVIDER, useExisting: MyModelProvider },
    { provide: AGENTIC_TOOL_PROVIDER, useExisting: MyToolProvider },
  ],
});
```

Then one call drives a whole turn:

```ts
const run = await agenticChatService.sendUserMessage({
  conversationId,
  text,
  userId,
  authInfo,
  signal,
});
```

## What the loop actually does

Up to `maxModelSteps` iterations of: list tools, stream the model, execute any tool
calls, feed the results back. It ends when a step produces no tool calls.

Every part is persisted and published as it streams, not at the end — so a client
subscribed to the event publisher renders text as it is generated, and a page
refreshed mid-run reads the same partial state back out of storage.

Four edge cases are handled because each one is a bug in the obvious
implementation:

- **Orphaned tool calls.** A tool call left `pending` or `streaming` when a step
  ends is finalized with an error result, so the transcript never contains a call
  with no result.
- **The step ceiling.** Tool calls outstanding at the last step get a synthetic
  `max_model_steps_reached` result rather than being dropped silently.
- **Abort.** The caller's `AbortSignal` and the per-call timeout are merged, so a
  hung tool cannot outlive its turn and a cancelled run terminates mid-stream with
  status `aborted` rather than `error`.
- **Stale errored tools.** When a prior run left a failed tool call in the
  transcript, its call and result are filtered out of the messages replayed to the
  model. Without this, one failure keeps being re-sent on every subsequent turn and
  the model keeps reacting to it.

## Conversation lifecycle and prompts

`AgenticConversationLifecycleService` covers create, rename, list, soft-delete and
deterministic get-or-create — the last being what makes a conversation id like
`app:invoice:1234` resolve to the same conversation every time.

`AgenticPromptLibraryService` and `AgenticPromptLibraryController` provide a
per-owner library of reusable prompts with `{{parameter}}` templating.

## Transport is yours

This package ships a no-op publisher and nothing else: implement
`AgenticEventPublisher` over websockets, SSE, or Postgres `LISTEN/NOTIFY`,
whichever fits. Clients fold the resulting events with `reduceAgenticEvent` from
the isomorphic package.

## License

MIT
