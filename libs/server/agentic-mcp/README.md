# @onivoro/server-agentic-mcp

Connects MCP to an agentic run loop, in both directions: exposes this server's
own MCP tools to
[`@onivoro/server-agentic`](https://www.npmjs.com/package/@onivoro/server-agentic),
and consumes _remote_ MCP servers as tools the loop can call.

## Installation

```bash
npm install @onivoro/server-agentic-mcp @onivoro/server-mcp @onivoro/server-mcp-llm-adapter
```

## Exposing your own tools

A tool written once with `@McpTool` is then served two ways — over Streamable
HTTP to outside clients by `@onivoro/server-mcp`, and in-process to the run loop
by this package.

```ts
import { AgenticMcpModule } from '@onivoro/server-agentic-mcp';

AgenticMcpModule.configure({ namespace: 'acme' });
```

That registers `AGENTIC_TOOL_PROVIDER`, so `AgenticChatModule` picks it up.
Tools reach the model as `mcp__acme__<tool>`; set `exposeNamespace: false` to
use bare names.

Under the hood this is `McpLlmToolAdapter` with an `LlmAdapterConfig` that
formats into the agentic contract's shape — so the loop is one more adapter
consumer alongside Claude and Bedrock Converse, and inherits alias resolution
and name sanitization rather than reimplementing them.

## Filling arguments from conversation metadata

A conversation anchored to a record carries that record's identifiers. When a
tool declares a property the conversation already knows, this fills it in — so
the model does not restate an id it was never shown, and cannot get it wrong.

Opt in by naming the keys; with none configured it is a pass-through.

```ts
AgenticMcpModule.configure({
  namespace: 'acme',
  inputContext: {
    contextKeys: ['invoiceId', 'customerId'],
    aliases: { customerId: ['accountId'] },
    filtersKey: 'filters',
    filtersExclude: ['resourceId'],
    identifiersKey: 'identifiers',
  },
});
```

Rules, in order:

- A value the model supplied always wins; context only fills gaps.
- Only properties the tool's schema declares are filled — nothing is invented.
- `aliases` resolve a canonical key from an alternate name, in the input or the
  metadata — which doubles as a rename, since the metadata key and the schema
  property need not agree (`aliases: { id: ['workOrderId'] }`).
- When a tool declares the canonical key but not the alias, the alias is dropped
  from the call. Sending both invites the model to disagree with itself about
  which record it meant.
- `filtersKey` names a property that takes a nested bag of context instead of a
  single value — a search tool's `filters` object. It is left absent rather than
  set to an empty object when there is nothing to put in it.
- `identifiersKey` names the nested metadata object also searched for values,
  defaulting to `identifiers`. Set it to `''` to search only the metadata root.

## Consuming remote MCP servers

```ts
import { StandardMcpClientAgenticToolProvider } from '@onivoro/server-agentic-mcp';

const provider = new StandardMcpClientAgenticToolProvider(mcpClient, {
  namespace: 'github',
});
```

Anything with `listTools` and `callTool` works, so an official MCP SDK client
drops straight in. Combine sources with `CompositeAgenticToolProvider`:

```ts
new CompositeAgenticToolProvider([localTools, githubTools, jiraTools]);
```

## Authorization

This package deliberately has no opinion about permissions. Decorate the
provider instead — filter `listTools` to what the caller may see, re-check on
`executeTool`, and audit. `McpAuthUnwrappingToolProvider` handles the narrower
job of unwrapping a verified auth context before delegating.

Keeping policy outside means tools stay unaware of who is calling them, which is
what lets the same tool serve an HTTP client and an in-process loop.

## Tool catalogue page

`McpToolCatalogService` and `renderMcpToolCatalogHtml` render a browsable page of
the registered tools with a copy-pasteable client config. Grouping defaults to
the verb in the tool name; pass `resolveGroupLabel` to group by subject instead.

## License

MIT
