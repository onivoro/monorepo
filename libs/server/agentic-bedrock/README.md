# @onivoro/server-agentic-bedrock

An AWS Bedrock streaming model provider for
[`@onivoro/server-agentic`](https://www.npmjs.com/package/@onivoro/server-agentic).

Invokes `InvokeModelWithResponseStream` and normalizes the result into the
`AgenticModelEvent` union, so the run loop never learns anything about Bedrock.
Wire formats are pluggable: the Anthropic Messages API is the default, and
another model family is one `IAgenticBedrockProtocol` away.

## Installation

```bash
npm install @onivoro/server-agentic-bedrock @onivoro/server-agentic @onivoro/isomorphic-agentic \
  @aws-sdk/client-bedrock-runtime @nestjs/common @nestjs/core
```

## Minimum configuration

Two options matter. Everything else has a working default.

```ts
import { AgenticChatModule } from '@onivoro/server-agentic';
import { AgenticBedrockModule } from '@onivoro/server-agentic-bedrock';

AgenticChatModule.configure({
  imports: [
    AgenticBedrockModule.configure({
      region: 'us-east-2',
      modelId: 'us.anthropic.claude-opus-5',
    }),
  ],
  providers: [
    /* AGENTIC_REPOSITORIES, ... */
  ],
});
```

The module provides and exports `AGENTIC_MODEL_PROVIDER` (as
`BedrockModelProvider`), so importing it into `AgenticChatModule` is all the
wiring the loop needs. It also exports `AGENTIC_BEDROCK_CONFIG`,
`BedrockModelProvider`, and the `BedrockRuntimeClient` it creates from `region`.

## Options

`AgenticBedrockConfig`; defaults are in `DEFAULT_AGENTIC_BEDROCK_CONFIG`.

| Option             | Default                     | Notes                                                                                                                            |
| ------------------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `region`           | SDK resolution              | Where the model lives, not necessarily where you run.                                                                            |
| `modelId`          | `anthropic.claude-opus-5`   | Usually an inference profile — see below. A request's `model` overrides it.                                                      |
| `protocol`         | `anthropicMessagesProtocol` | Wire format.                                                                                                                     |
| `defaultMaxTokens` | `64000`                     | Used when a request carries none.                                                                                                |
| `anthropicVersion` | `bedrock-2023-05-31`        | Bedrock's Anthropic API version.                                                                                                 |
| `sendTemperature`  | `false`                     | **Leave off for current models** — see below.                                                                                    |
| `thinking`         | omitted                     | Verify support first — see below.                                                                                                |
| `effort`           | omitted                     | `low` / `medium` / `high` / `xhigh` / `max`, sent as `output_config.effort`. Verify support first.                               |
| `buildRequestBody` | —                           | Escape hatch: `(request) => body`, replacing the protocol's builder. It receives no defaults, so the options above do not apply. |

### modelId: pass the inference profile

Prefer `us.anthropic.claude-opus-5` over the bare `anthropic.claude-opus-5`.
System-defined profiles spread capacity across regions, which matters for a loop
making many streaming calls per conversation.

If you do, the IAM policy needs **both** ARNs:

```
arn:aws:bedrock:<region>:<account>:inference-profile/us.anthropic.claude-opus-5
arn:aws:bedrock:*::foundation-model/anthropic.claude-opus-5
```

The wildcard region on the second is deliberate: a cross-region profile is
authorized against the underlying model in every region it can route to. Grant
one without the other and every call fails as `AccessDeniedException` without
saying which half is missing.

### sendTemperature: off on purpose

Current frontier models **reject sampling parameters with a 400** rather than
ignoring them. The run loop's `AgenticModelRequest` still carries a
`temperature`, so both shipped protocols drop it unless you opt in. Turn it on
only for a model you know accepts it.

### thinking and effort: verify before enabling

Both are passed through untouched by the Anthropic protocol and both are omitted
by default. Support and accepted shape vary by model, and availability on
Bedrock lags the first-party API — an unsupported value is a 400 on every
request, not a degraded response. Check against the model you are targeting,
then:

```ts
AgenticBedrockModule.configure({
  region: 'us-east-2',
  modelId: 'us.anthropic.claude-opus-5',
  thinking: { type: 'adaptive', display: 'summarized' },
  effort: 'high',
});
```

## Stream behaviour

Each `stream` call yields `step-start`, then whatever the protocol's parser
produces, then the parser's closing events (`step-finish` and `finish`). The
request's abort signal is passed to the SDK, and an abort noticed mid-stream
yields `finish` with reason `abort`. Bedrock exceptions delivered inside the
stream (throttling, validation, model timeout, and so on) become a retryable
`provider-error`, which the run loop treats as a failed run.

## Protocols

A protocol is a request builder plus a stream parser:

```ts
interface IAgenticBedrockProtocol {
  readonly name: string;
  buildRequestBody(request: AgenticModelRequest, defaults: AgenticBedrockRequestDefaults): unknown;
  createParser(stepIndex: number): IAgenticBedrockStreamParser;
}

interface IAgenticBedrockStreamParser {
  parse(chunk: unknown): AgenticModelEvent[]; // per decoded chunk
  finish(): AgenticModelEvent[]; // close open blocks, emit step-finish and finish
}
```

`AgenticBedrockRequestDefaults` carries `maxTokens`, `anthropicVersion`,
`sendTemperature`, `thinking` and `effort`, resolved from config.

Two ship with the package:

- **`anthropicMessagesProtocol`** (default, `name: 'anthropic-messages'`) — the
  Anthropic Messages API.
- **`kimiK25MantleProtocol`** (`name: 'kimi-k25-mantle'`) — Kimi K2.5, which
  takes an OpenAI-shaped body and emits tool calls as inline text markers rather
  than `tool_use` blocks. Its builder applies `defaultMaxTokens` and sends a
  request's `temperature` only when `sendTemperature` is on; it ignores
  `thinking` and `effort`. System and summary messages become `system`-role
  messages.

A custom protocol can reuse the shipped parser:

```ts
import { BedrockMessagesStreamParser, IAgenticBedrockProtocol } from '@onivoro/server-agentic-bedrock';

export const myProtocol: IAgenticBedrockProtocol = {
  name: 'my-model',
  buildRequestBody: (request, defaults) => ({
    messages: toMyMessages(request.messages),
    max_tokens: request.maxTokens ?? defaults.maxTokens,
  }),
  createParser: (stepIndex) => new BedrockMessagesStreamParser(stepIndex),
};

AgenticBedrockModule.configure({ modelId: 'my.model-v1', protocol: myProtocol });
```

`BedrockMessagesStreamParser` backs both shipped protocols. It reads Anthropic
`content_block_*` / `message_delta` / `message_stop` chunks and OpenAI-style
`choices[].delta` chunks (text, reasoning and `tool_calls`), normalizes stop
reasons, and uses `AgenticToolArgumentStream` for tool arguments. Its
inline-marker scanning is opt-in (`BedrockMessagesStreamParserOptions.nativeToolCallSyntax`),
because detecting those markers means holding back any text that might begin
one — needless latency for a model that emits real content blocks.

Usage is merged across the stream rather than taken from the last chunk:
Anthropic input tokens come from `message_start` and output tokens from the
cumulative `message_delta` count; OpenAI-style usage is read from any chunk,
including the final one whose `choices` is empty. A chunk without usage leaves
earlier figures intact.

### Message mapping

Three rules in the Anthropic builder are worth knowing, because each is a defect
if you write your own and skip it:

- System and summary messages are lifted into the top-level `system` field
  (after the request's own `system`); the Messages API has no system role inside
  `messages`.
- Tool results become `tool_result` blocks on a **user** message, not a message
  of role `tool`.
- Consecutive tool results are merged into **one** user message. The run loop
  persists a message per result, and delivering them separately trains the model
  to stop making parallel tool calls.

It also drops leading assistant messages, since the Messages API requires the
first message to come from the user, and replays reasoning parts as plain text.

## Building blocks

The builders are exported for reuse and testing:

- Anthropic: `buildAnthropicMessagesRequestBody(request, defaults)`,
  `toAnthropicMessages(request)` → `{ system, messages }`, `toAnthropicTool`,
  and the `Anthropic*` body/block types.
- Kimi: `buildKimiK25MantleRequestBody(request)`, `toKimiK25MantleMessages`,
  `toKimiK25MantleTool`, `extractKimiK25MantleText(body)` (pulls the text out of
  a non-streaming response), and the `KimiK25Mantle*` types.
- `BedrockModelProvider` — the injectable provider itself (`provider: 'bedrock'`).

## License

MIT
