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
npm install @onivoro/server-agentic @onivoro/isomorphic-agentic @nestjs/common @nestjs/core @nestjs/swagger
```

## Wiring

Everything environmental is a token, so the loop is testable with fakes and no
network:

| Token                     | Supplies                                                                                 | Required |
| ------------------------- | ---------------------------------------------------------------------------------------- | -------- |
| `AGENTIC_REPOSITORIES`    | `AgenticRepositories`: `messages` required; `runs`, `usage`, `prompts` used when present | yes      |
| `AGENTIC_MODEL_PROVIDER`  | the streaming model                                                                      | yes      |
| `AGENTIC_TOOL_PROVIDER`   | tool discovery and execution (none: the model gets no tools)                             | no       |
| `AGENTIC_EVENT_PUBLISHER` | delivery to clients (defaults to `NoopAgenticEventPublisher`)                            | no       |
| `AGENTIC_ID_GENERATOR`    | id minting (defaults to `DefaultAgenticIdGenerator`: `<prefix>_<uuid>`)                  | no       |
| `AGENTIC_CHAT_CONFIG`     | `AgenticChatConfig`, from the `config` option                                            | no       |

`AgenticChatModule.configure` registers the config, id generator, no-op
publisher, `AgenticChatService` and `AgenticPromptLibraryService`, then your
`providers` — which come later and so override the defaults. Modules that
provide a token (such as `AgenticBedrockModule` or `AgenticMcpModule`) go in
`imports`:

```ts
import { AgenticChatModule, AGENTIC_EVENT_PUBLISHER, AGENTIC_REPOSITORIES } from '@onivoro/server-agentic';
import { AgenticBedrockModule } from '@onivoro/server-agentic-bedrock';
import { AgenticMcpModule } from '@onivoro/server-agentic-mcp';

AgenticChatModule.configure({
  config: {
    maxModelSteps: 12,
    toolExecutionTimeoutMs: 120_000,
    defaultSystemPrompt: SYSTEM_PROMPT,
  },
  imports: [AgenticBedrockModule.configure({ region: 'us-east-2', modelId: 'us.anthropic.claude-opus-5' }), AgenticMcpModule.configure({ namespace: 'acme' })],
  providers: [
    { provide: AGENTIC_REPOSITORIES, useClass: MyRepositories },
    { provide: AGENTIC_EVENT_PUBLISHER, useClass: MyWebsocketPublisher },
  ],
});
```

The module exports `AgenticChatService`, `AgenticPromptLibraryService`,
`AGENTIC_CHAT_CONFIG`, `AGENTIC_EVENT_PUBLISHER`, `AGENTIC_ID_GENERATOR`, and
whatever you list in `exports`.

### Config

| Option                    | Default (`DEFAULT_AGENTIC_CHAT_CONFIG`) | Effect                                   |
| ------------------------- | --------------------------------------- | ---------------------------------------- |
| `maxModelSteps`           | `6`                                     | Model calls per turn                     |
| `toolExecutionTimeoutMs`  | `120_000`                               | Per tool call; `0` disables the timer    |
| `maxToolResultTextLength` | `12_000`                                | Tool `resultText` is truncated past this |
| `defaultSystemPrompt`     | —                                       | Used when a send carries no `system`     |
| `metadata`                | —                                       | Carried in config; not read by the loop  |

## Sending a message

One call drives a whole turn:

```ts
const run = await agenticChatService.sendUserMessage({
  conversationId,
  text,
  userId,
  sessionId,
  authInfo, // handed to the tool provider untouched
  metadata, // stored on the user message and run, passed to the model and tools
  signal, // AbortSignal
  // optional per-call overrides: system, model, temperature, maxTokens
});
```

It persists the user message and an empty streaming assistant message, creates
the run (when `repositories.runs` exists), loops, then stores the final status
and usage. It resolves with the finished `AgenticRun`. An aborted run resolves
with status `aborted`; any other failure marks the message and run `error`,
publishes `run.error`, and rethrows.

## What the loop actually does

Up to `maxModelSteps` iterations of: list tools, stream the model, execute any tool
calls in order, feed the results back. It ends when a step produces no tool calls.

Every part is persisted and published as it streams, not at the end — so a client
subscribed to the event publisher renders text as it is generated, and a page
refreshed mid-run reads the same partial state back out of storage. Each tool
result is stored as its own `tool`-role message.

Edge cases handled because each one is a bug in the obvious implementation:

- **Orphaned tool calls.** A tool call left `pending` or `streaming` when a step
  ends is finalized with an `incomplete_tool_call` error result, so the
  transcript never contains a call with no result.
- **Unparseable arguments.** A call whose input failed JSON parsing (the
  `_parseError` shape from `parseToolInput`) is not executed; the model gets an
  `invalid_tool_arguments` error result instead.
- **The step ceiling.** Tool calls outstanding at the last step get a synthetic
  `max_model_steps_reached` result rather than being dropped silently.
- **Abort and timeout.** The caller's `AbortSignal` and the per-call timeout are
  merged into the signal the tool receives, and the loop stops waiting when it
  fires, so a hung tool cannot outlive its turn. A thrown tool error becomes an
  error result the model sees, not a failed run. A cancelled model stream ends
  the run as `aborted` rather than `error`.
- **Provider errors.** A `provider-error` event publishes `run.error` and fails
  the run.
- **Stale errored tools.** When a prior run left a failed tool call in the
  transcript, its call and result are filtered out of the messages replayed to the
  model. Without this, one failure keeps being re-sent on every subsequent turn and
  the model keeps reacting to it.

## Conversation lifecycle

`AgenticConversationLifecycleService` covers create, rename/status update, list,
soft delete, message listing and deterministic get-or-create. It is not
registered by `AgenticChatModule` and its constructor has no injection token,
so construct it from your repositories. The message repository must also
implement `countByConversationId` and `listNewestByConversationId`
(`AgenticLifecycleMessageRepository`; the TypeORM package's does):

```ts
import {
  AGENTIC_REPOSITORIES,
  AgenticConversationLifecycleRepositories,
  AgenticConversationLifecycleService,
} from '@onivoro/server-agentic';

{
  provide: AgenticConversationLifecycleService,
  useFactory: (repositories: AgenticConversationLifecycleRepositories) =>
    new AgenticConversationLifecycleService(repositories),
  inject: [AGENTIC_REPOSITORIES],
}
```

Put that in `AgenticChatModule.configure({ providers, exports })`, or export
`AGENTIC_REPOSITORIES` from it if the factory lives in another module — tokens
you provide there are not exported unless listed.

| Method                                                                              | Behaviour                                                                 |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `createConversation({ id?, title?, metadata?, user })`                              | `ConflictException` if the id exists; caller becomes the sole participant |
| `ensureConversation({ conversationId, title?, metadata?, user })`                   | Get-or-create; merges new metadata and fills a missing title              |
| `getConversation(id, user)`                                                         | `NotFoundException` when missing, deleted, or not accessible              |
| `updateConversation({ conversationId, title?, status?, user })`                     | Participants only                                                         |
| `deleteConversation({ conversationId, user })`                                      | Soft delete: sets status `deleted`                                        |
| `listConversations({ participantId, limit?, search?, resourceType?, resourceId? })` | Active conversations, with `messageCount`, `lastMessageAt`, `preview`     |
| `listMessages(id, user)`                                                            | Access check, then the conversation's messages                            |
| `touchConversation(id)`                                                             | Bumps `updatedAt`                                                         |

`ensureConversation` is what makes an id like `acme:invoice:1234` resolve to the
same conversation every time. **Resource conversations are shared:** a
conversation whose metadata has a string `resourceType` and a string or number
`resourceId` can be read by any user, and listing with both `resourceType` and
`resourceId` drops the participant filter. Only participants can rename or
delete. Authorize access to the underlying record before calling these.

`user` is an `AgenticConversationUserContext` (`participantId`, optional
`metadata` that is merged into a new conversation's metadata).

### Controller helpers

Thin functions for writing your own conversation controller, each taking the
`lifecycle` service and an `AgenticParticipantContext` user:
`listLifecycleAgenticConversations`, `createLifecycleAgenticConversation`,
`getLifecycleAgenticConversation`, `updateLifecycleAgenticConversation`,
`deleteLifecycleAgenticConversation` and `listLifecycleAgenticMessages`.

`sendLifecycleAgenticMessage` is the send route in one call: ensure the
conversation (titled from the prompt via `titleFromPrompt`), merge its metadata
with the message's, resolve `authInfo` (a value or a function), build the system
prompt (a string or a function of the merged metadata), run the turn, and touch
the conversation:

```ts
import { SendAgenticMessageDto, sendLifecycleAgenticMessage } from '@onivoro/server-agentic';

@Post('conversations/:conversationId/messages')
send(@Req() req, @Param('conversationId') conversationId: string, @Body() body: SendAgenticMessageDto) {
  return sendLifecycleAgenticMessage({
    agenticChat: this.agenticChat,
    lifecycle: this.lifecycle,
    conversationId,
    text: body.text,
    messageMetadata: body.metadata,
    user: { participantId: req.user.email },
    userId: req.user.id,
    authInfo: () => this.authInfoFor(req),
    system: (metadata) => buildSystemPrompt(metadata),
  });
}
```

`sessionId` defaults to the conversation id.

`parseAgenticHistoryLimit(limit)` parses a `limit` query string: missing,
non-numeric or non-positive gives `undefined`; larger values are truncated and
clamped to `AGENTIC_HISTORY_LIMIT_MAX` (`100`).

`titleFromPrompt(text)` collapses whitespace and keeps the first 72 characters.

## Prompt library

`AgenticPromptLibraryService` provides a per-owner library of reusable prompts
with `{{parameter}}` templating. It needs `repositories.prompts`, and throws when
it is missing.

- `listPrompts({ user, limit?, search? })`
- `createPrompt({ user, title, prompt, id?, metadata? })` — trims, requires a
  non-empty title and prompt, extracts parameters; ids default to `prompt_<uuid>`.
- `updatePrompt({ user, promptId, title?, prompt?, metadata? })`
- `deletePrompt(promptId, user)`
- `renderPrompt({ user, promptId, values })` → `{ prompt, text }`

`user` is `{ participantId }`. Template and validation errors become
`BadRequestException`; a prompt the user does not own is `NotFoundException`.

`AgenticPromptLibraryController<TUser, TRequest>` is an abstract base with the
routes; subclass it, add `@Controller`, and say how a request maps to a user:

```ts
import { Controller } from '@nestjs/common';
import { AgenticPromptLibraryController, AgenticPromptLibraryService, AgenticPromptOwnerContext } from '@onivoro/server-agentic';

@Controller('agentic-chat')
export class PromptLibraryController extends AgenticPromptLibraryController<AgenticPromptOwnerContext, AppRequest> {
  constructor(service: AgenticPromptLibraryService) {
    super(service);
  }

  protected getPromptLibraryUser(request: AppRequest) {
    return { participantId: request.user.email };
  }
}
```

| Route                           | Action                                 |
| ------------------------------- | -------------------------------------- |
| `GET prompts?q&limit`           | list                                   |
| `POST prompts`                  | create (`CreateAgenticPromptDto`)      |
| `POST prompts/:promptId`        | update (`UpdateAgenticPromptDto`), 200 |
| `DELETE prompts/:promptId`      | delete, 204                            |
| `POST prompts/:promptId/render` | render (`RenderAgenticPromptDto`)      |

These are the routes `@onivoro/browser-agentic` calls under `/api/agentic-chat`.
The service argument only has to satisfy
`AgenticPromptLibraryControllerService<TUser>`, so a wrapper with a different
user type works too.

## Transport is yours

This package ships `NoopAgenticEventPublisher` and nothing else: implement
`AgenticEventPublisher` over websockets, SSE, or Postgres `LISTEN/NOTIFY`,
whichever fits. Clients fold the resulting events with `reduceAgenticEvent` from
the isomorphic package.

## Other exports

- DTO interfaces: `SendAgenticMessageDto`, `CreateAgenticConversationDto`,
  `UpdateAgenticConversationDto`, `CreateAgenticPromptDto`,
  `UpdateAgenticPromptDto`, `RenderAgenticPromptDto`.
- `AgenticIdGenerator` (`createId(prefix?)`) and `DefaultAgenticIdGenerator`.
- `AgenticSendUserMessageInput`, `AgenticChatModuleConfig`, and the lifecycle
  input types.

## License

MIT
