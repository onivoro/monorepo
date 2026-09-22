# @onivoro/server-agentic-bedrock

An AWS Bedrock streaming model provider for
[`@onivoro/server-agentic`](https://www.npmjs.com/package/@onivoro/server-agentic).

Invokes `InvokeModelWithResponseStream` and normalizes the result into the
`AgenticModelEvent` union, so the run loop never learns anything about Bedrock.
Wire formats are pluggable: the Anthropic Messages API is the default, and
another model family is one `IAgenticBedrockProtocol` away.

## Installation

```bash
npm install @onivoro/server-agentic-bedrock @aws-sdk/client-bedrock-runtime
```

## Minimum configuration

Two options. Everything else has a working default.

```ts
import { AgenticBedrockModule } from '@onivoro/server-agentic-bedrock';

AgenticBedrockModule.configure({
  region: 'us-east-2',
  modelId: 'us.anthropic.claude-opus-5',
});
```

That registers itself as `AGENTIC_MODEL_PROVIDER`, so `AgenticChatModule` picks
it up with no further wiring.

## Options

| Option             | Default                     | Notes                                                 |
| ------------------ | --------------------------- | ----------------------------------------------------- |
| `region`           | SDK resolution              | Where the model lives, not necessarily where you run. |
| `modelId`          | `anthropic.claude-opus-5`   | Usually an inference profile — see below.             |
| `protocol`         | `anthropicMessagesProtocol` | Wire format.                                          |
| `defaultMaxTokens` | `64000`                     | Used when a request carries none.                     |
| `anthropicVersion` | `bedrock-2023-05-31`        | Bedrock's Anthropic API version.                      |
| `sendTemperature`  | `false`                     | **Leave off for current models** — see below.         |
| `thinking`         | omitted                     | Verify support first — see below.                     |
| `effort`           | omitted                     | Verify support first — see below.                     |
| `buildRequestBody` | —                           | Escape hatch; replaces the protocol's builder.        |

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
`temperature`, so this provider drops it unless you opt in. Turn it on only for
a model you know accepts it.

### thinking and effort: verify before enabling

Both are passed through untouched and both are omitted by default. Support and
accepted shape vary by model, and availability on Bedrock lags the first-party
API — an unsupported value is a 400 on every request, not a degraded response.
Check against the model you are targeting, then:

```ts
AgenticBedrockModule.configure({
  region: 'us-east-2',
  modelId: 'us.anthropic.claude-opus-5',
  thinking: { type: 'adaptive', display: 'summarized' },
  effort: 'high',
});
```

## Protocols

A protocol is a request builder plus a stream parser:

```ts
interface IAgenticBedrockProtocol {
  readonly name: string;
  buildRequestBody(request, defaults): unknown;
  createParser(stepIndex): IAgenticBedrockStreamParser;
}
```

Two ship with the package:

- **`anthropicMessagesProtocol`** (default) — the Anthropic Messages API.
- **`kimiK25MantleProtocol`** — Kimi K2.5, which takes an OpenAI-shaped body and
  emits tool calls as inline text markers rather than `tool_use` blocks.

`BedrockMessagesStreamParser` backs both. Its inline-marker scanning is opt-in
(`nativeToolCallSyntax`), because detecting those markers means holding back any
text that might begin one — needless latency for a model that emits real content
blocks.

### Message mapping

Three rules in the Anthropic builder are worth knowing, because each is a defect
if you write your own and skip it:

- System and summary messages are lifted into the top-level `system` field; the
  Messages API has no system role inside `messages`.
- Tool results become `tool_result` blocks on a **user** message, not a message
  of role `tool`.
- Consecutive tool results are merged into **one** user message. The run loop
  persists a message per result, and delivering them separately trains the model
  to stop making parallel tool calls.

## License

MIT
