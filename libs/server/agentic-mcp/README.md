# @onivoro/server-agentic-mcp

Connects MCP to an agentic run loop, in both directions: exposes this server's
own MCP tools to
[`@onivoro/server-agentic`](https://www.npmjs.com/package/@onivoro/server-agentic),
and consumes _remote_ MCP servers as tools the loop can call.

## Installation

```bash
npm install @onivoro/server-agentic-mcp @onivoro/server-agentic @onivoro/isomorphic-agentic \
  @onivoro/server-mcp @onivoro/server-mcp-llm-adapter @onivoro/server-html \
  @nestjs/common @nestjs/core
```

## Exposing your own tools

A tool written once with `@McpTool` is then served two ways — over Streamable
HTTP to outside clients by `@onivoro/server-mcp`, and in-process to the run loop
by this package.

```ts
import { AgenticChatModule } from '@onivoro/server-agentic';
import { AgenticMcpModule } from '@onivoro/server-agentic-mcp';

AgenticChatModule.configure({
  imports: [AgenticMcpModule.configure({ namespace: 'acme' })],
  providers: [
    /* AGENTIC_REPOSITORIES, ... */
  ],
});
```

`AgenticMcpModule` provides and exports `AGENTIC_TOOL_PROVIDER` (as
`McpRegistryAgenticToolProvider`), so importing it into `AgenticChatModule` is
the whole wiring. It also exports `AGENTIC_MCP_CONFIG` and its
`McpLlmToolAdapter`.

Tools reach the model as `mcp__<namespace>__<tool>` — `mcp__acme__<tool>` here,
`mcp__mcp__<tool>` with the default namespace `mcp` — with characters outside
`[A-Za-z0-9_-]` replaced by `_`. Set `exposeNamespace: false` to use bare
(sanitized) names. Defaults are in `DEFAULT_AGENTIC_MCP_CONFIG`.

### Sharing the tool registry

`configure(config, imports)` takes a second argument: the modules that supply
`McpToolRegistry`. It defaults to `[McpRegistryModule.registerOnly()]`, a
registry of its own. A host that also serves MCP over HTTP already has one and
should pass the module that exports it — otherwise tools land in one registry and
the loop reads the other:

```ts
AgenticMcpModule.configure({ namespace: 'acme' }, [MyMcpModule]);
```

Under the hood this is `McpLlmToolAdapter` with an `LlmAdapterConfig` that
formats into the agentic contract's shape (`agenticLlmAdapterConfig(config)`,
alias key `agentic`) — so the loop is one more adapter consumer alongside the
Claude, Bedrock and other provider configs in `@onivoro/server-mcp-llm-adapter`,
and inherits alias resolution and name sanitization rather than reimplementing
them.

`McpRegistryAgenticToolProvider` forwards the run's abort signal, session id
and progress/log channels to the tool, and passes `context.authInfo` as the MCP
auth info. A failed tool comes back as an error result for the model, not an
exception.

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
- Each context key is read from the metadata root first, then from the nested
  `identifiersKey` object.
- `aliases` resolve a canonical key from an alternate name, in the input or the
  metadata — which doubles as a rename, since the metadata key and the schema
  property need not agree (`aliases: { id: ['workOrderId'] }`).
- When a tool declares the canonical key but not the alias, the alias is dropped
  from the call. Sending both invites the model to disagree with itself about
  which record it meant.
- `filtersKey` names a property that takes a nested bag of context instead of a
  single value — a search tool's `filters` object. It applies only when the
  schema declares that property, merges every context key not in
  `filtersExclude` into whatever the model sent, and is left absent rather than
  set to an empty object when there is nothing to put in it.
- `identifiersKey` names the nested metadata object also searched for values,
  defaulting to `identifiers`. Set it to `''` to search only the metadata root.

The same logic is exported as
`normalizeAgenticToolInputFromContext(input, metadata, inputSchema?, config?)`,
with defaults in `DEFAULT_AGENTIC_TOOL_INPUT_CONTEXT_CONFIG`:

```ts
normalizeAgenticToolInputFromContext({}, { identifiers: { invoiceId: 'inv-1' } }, { type: 'object', properties: { invoiceId: { type: 'string' } } }, { contextKeys: ['invoiceId'] });
// { invoiceId: 'inv-1' }
```

## Consuming remote MCP servers

```ts
import { CompositeAgenticToolProvider, StandardMcpClientAgenticToolProvider } from '@onivoro/server-agentic-mcp';

const githubTools = new StandardMcpClientAgenticToolProvider(mcpClient, {
  namespace: 'github',
});
```

The second argument is an `AgenticMcpConfig` (`namespace`, `exposeNamespace`,
`inputContext`). Anything matching `StandardMcpClientLike` — `listTools()`
returning `{ tools }` and `callTool({ name, arguments })` — works, so an official
MCP SDK client drops straight in. Tool names are exposed as above and mapped
back to the server's original name on execution. The raw `callTool` result is
returned as the tool result, with `resultText` its JSON rendering.

Combine sources with `CompositeAgenticToolProvider`, and register the result as
`AGENTIC_TOOL_PROVIDER` yourself:

```ts
import { AGENTIC_TOOL_PROVIDER } from '@onivoro/server-agentic';
import { McpRegistryAgenticToolProvider } from '@onivoro/server-agentic-mcp';

{
  provide: AGENTIC_TOOL_PROVIDER,
  useFactory: (local: McpRegistryAgenticToolProvider) =>
    new CompositeAgenticToolProvider([local, githubTools]),
  inject: [McpRegistryAgenticToolProvider],
}
```

It lists every provider's tools, and routes a call to the first provider whose
list contains that name; an unknown name is an error result.

## Authorization

This package deliberately has no opinion about permissions. Decorate the
provider instead — filter `listTools` to what the caller may see, re-check on
`executeTool`, and audit.

`listMcpAuthWrappedTools` and `executeMcpAuthWrappedTool` handle the narrower
job of unwrapping your app's auth context (`context.authInfo`) into an
`McpAuthInfo` before delegating to a `McpRegistryAgenticToolProvider`:

```ts
import { AgenticToolCall, AgenticToolExecutionContext, AgenticToolProvider } from '@onivoro/isomorphic-agentic';
import { executeMcpAuthWrappedTool, listMcpAuthWrappedTools, McpAuthUnwrappingOptions, McpRegistryAgenticToolProvider } from '@onivoro/server-agentic-mcp';

const options: McpAuthUnwrappingOptions<AppAuth> = {
  isAuthContext: (value): value is AppAuth => value instanceof AppAuth,
  getMcpAuthInfo: (auth) => auth.mcpAuthInfo,
  authUnavailableCode: 'mcp_auth_unavailable',
  authUnavailableMessage: 'Sign in again to use tools.',
};

export class AppToolProvider implements AgenticToolProvider {
  constructor(private readonly delegate: McpRegistryAgenticToolProvider) {}

  listTools(context: AgenticToolExecutionContext) {
    return listMcpAuthWrappedTools(this.delegate, context, options);
  }

  executeTool(call: AgenticToolCall, context: AgenticToolExecutionContext) {
    return executeMcpAuthWrappedTool(this.delegate, call, context, options);
  }
}
```

Without a usable auth context, `list` returns no tools and `execute` returns an
error result with `authUnavailableCode` (and `getError`'s message when given).
An unknown tool name is an `mcp_tool_unknown` error result.

Keeping policy outside means tools stay unaware of who is calling them, which is
what lets the same tool serve an HTTP client and an in-process loop.

## Tool catalogue page

`McpToolCatalogService` and `renderMcpToolCatalogHtml` render a browsable HTML
page of the registered tools — names, titles, descriptions, annotations and
input schemas — with an installation guide for [opencode](https://opencode.ai/),
[Claude Code](https://claude.com/claude-code), Claude Desktop and
[Codex](https://developers.openai.com/codex). `AgenticMcpModule` does not
provide the service; register it where `McpToolRegistry` is available.

```ts
@Get('mcp-tools')
tools() {
  return {
    value: this.catalog.renderHtml({
      serverUrl: 'https://acme.example.com',
      serverName: 'acme',
      resolveGroupLabel: (name) => name.split('-')[0],
    }),
  };
}
```

`McpToolCatalogRenderConfig`:

| Option                   | Default                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------- |
| `serverUrl`              | required                                                                               |
| `mcpUrl`                 | `${serverUrl}/api/mcp`                                                                 |
| `serverName`             | `mcp-server`; the name the server is registered under in every client                  |
| `clients`                | `['opencode', 'claude-code', 'claude-desktop', 'codex']`; the sections shown, in order |
| `oauthClientId`          | none; a pre-registered OAuth client for servers without dynamic client registration    |
| `oauthScope`             | none; the scope opencode requests with `oauthClientId`                                 |
| `claudeCodeCallbackPort` | `3118` (`DEFAULT_CLAUDE_CODE_CALLBACK_PORT`), used with `oauthClientId`                |
| `codexCallbackPort`      | none (Codex picks an ephemeral port)                                                   |
| `configJson`             | generated opencode config                                                              |
| `authCommand`            | `opencode mcp auth <serverName>`                                                       |
| `title`                  | `MCP Tool Catalog`                                                                     |
| `eyebrow`                | `Generated from McpToolRegistry`                                                       |
| `resolveGroupLabel`      | the verb in the name (`search-`, `-get-`, ...), else `Other`                           |
| `groupOrder`             | `Search, Get, List, Create, Update, Delete, Other`; other groups follow alphabetically |

`McpToolCatalogService.listTools()` returns the `McpToolCatalogEntry[]` the page
is built from.

### Pre-registered OAuth clients

When the authorization server supports dynamic client registration, leave
`oauthClientId` unset: each client registers itself on first sign-in. Servers
without it, such as Amazon Cognito, need one app client that every MCP client
signs in with. Pass its ID as `oauthClientId` and the guide adds it to each
client's setup:

```ts
this.catalog.renderHtml({
  serverUrl: 'https://acme.example.com',
  serverName: 'acme',
  oauthClientId: config.COGNITO_MCP_TOOLING_CLIENT_ID,
  oauthScope: 'openid email',
});
```

That app client must allow each client's OAuth callback URL:

| Client         | Callback URL                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| Claude Code    | `http://localhost:<claudeCodeCallbackPort>/callback` (default port `3118`)                              |
| Claude Desktop | `https://claude.ai/api/mcp/auth_callback` (`CLAUDE_CONNECTOR_CALLBACK_URL`)                             |
| Codex          | the URL `codex mcp add` prints; `http://127.0.0.1:<codexCallbackPort>/callback` when the port is pinned |
| opencode       | the URL opencode uses, e.g. `http://127.0.0.1:19876/mcp/oauth/callback`                                 |

`mcpClientCallbackUrls(options, targets?)` returns the fixed ones (Claude Code,
Claude Desktop, and Codex when `codexCallbackPort` is set). Claude Desktop
connects from Anthropic's servers, so its MCP URL must be reachable from the
internet.

The snippets are also exported for use outside the page:
`opencodeMcpConfig`, `opencodeMcpAuthCommand`, `claudeCodeMcpAddCommand`,
`codexMcpAddCommand`, `codexMcpCallbackPortSetting` and `codexMcpLoginCommand`
each take `McpClientSetupOptions` (`serverName`, `mcpUrl`, and the OAuth fields
above).

Every config value and tool field on the page (titles, eyebrow, group labels,
`configJson`, `authCommand`, the generated snippet, tool names, descriptions,
annotations and schemas) is rendered as `@onivoro/server-html` `textContent`,
so it is HTML-escaped exactly once: pass plain text and JSON, not pre-escaped
or HTML strings.

## License

MIT
