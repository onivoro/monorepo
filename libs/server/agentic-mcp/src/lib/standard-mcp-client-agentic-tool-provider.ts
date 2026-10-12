import {
  AgenticToolCall,
  AgenticToolDefinition,
  AgenticToolExecutionContext,
  AgenticToolExecutionResult,
  AgenticToolProvider,
} from '@onivoro/isomorphic-agentic';
import {
  AgenticMcpConfig,
  DEFAULT_AGENTIC_MCP_CONFIG,
} from './agentic-mcp-config';
import { normalizeAgenticToolInputFromContext } from './agentic-tool-input-context';

export interface StandardMcpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface StandardMcpClientLike {
  /** One page of tools; pass the previous page's `nextCursor` to get the next one. */
  listTools(params?: { cursor?: string }): Promise<{
    tools: StandardMcpToolDefinition[];
    nextCursor?: string;
  }>;
  callTool(
    params: {
      name: string;
      arguments?: Record<string, unknown>;
    },
    ...rest: unknown[]
  ): Promise<unknown>;
}

/** Stops a server that keeps returning cursors from paging forever. */
const MAX_TOOL_PAGES = 100;

export class StandardMcpClientAgenticToolProvider
  implements AgenticToolProvider
{
  /** The server's tools as last listed, for resolving calls without listing again. */
  private tools?: StandardMcpToolDefinition[];

  constructor(
    private readonly client: StandardMcpClientLike,
    private readonly config: AgenticMcpConfig = {},
  ) {}

  async listTools(
    _context?: AgenticToolExecutionContext,
  ): Promise<AgenticToolDefinition[]> {
    const tools = await this.fetchTools();
    return tools.map((tool) => ({
      name: this.exposeName(tool.name),
      description: tool.description,
      inputSchema: tool.inputSchema ?? { type: 'object', properties: {} },
      providerMetadata: {
        mcp: {
          originalName: tool.name,
          namespace: this.namespace(),
          client: 'standard',
        },
      },
    }));
  }

  async executeTool(
    call: AgenticToolCall,
    context: AgenticToolExecutionContext,
  ): Promise<AgenticToolExecutionResult> {
    const tool = await this.originalTool(call.name);
    if (!tool) {
      // The model must see this and pick another tool, not end the run.
      const message = `Unknown tool "${call.name}".`;
      return {
        toolCallId: call.id,
        name: call.name,
        result: message,
        resultText: message,
        isError: true,
        providerMetadata: {
          mcp: { namespace: this.namespace(), client: 'standard' },
        },
      };
    }

    const originalName = tool.name;
    const result = await this.client.callTool({
      name: originalName,
      arguments: normalizeAgenticToolInputFromContext(
        call.input,
        context.metadata,
        tool.inputSchema,
        this.config.inputContext,
      ),
    });
    const isError = isErrorResult(result);

    return {
      toolCallId: call.id,
      name: call.name,
      result,
      resultText: isError ? errorText(result) : stringifyUnknown(result),
      ...(isError && { isError: true }),
      providerMetadata: {
        mcp: {
          originalName,
          namespace: this.namespace(),
          client: 'standard',
        },
      },
    };
  }

  /** Every page of the server's tools, remembered for later calls. */
  private async fetchTools(): Promise<StandardMcpToolDefinition[]> {
    const tools: StandardMcpToolDefinition[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < MAX_TOOL_PAGES; page++) {
      const result = await this.client.listTools(
        cursor === undefined ? undefined : { cursor },
      );
      tools.push(...result.tools);
      cursor = result.nextCursor;
      if (!cursor) break;
    }
    this.tools = tools;
    return tools;
  }

  private exposeName(name: string): string {
    if (this.config.exposeNamespace === false) return name;
    return `mcp__${sanitize(this.namespace())}__${sanitize(name)}`;
  }

  /**
   * The server tool an exposed name refers to, from the remembered list. A name that isn't
   * there may be a tool the server added since, so the list is fetched once more.
   */
  private async originalTool(
    name: string,
  ): Promise<StandardMcpToolDefinition | undefined> {
    if (this.tools) {
      const known = this.matchTool(this.tools, name);
      if (known) return known;
    }
    return this.matchTool(await this.fetchTools(), name);
  }

  private matchTool(
    tools: StandardMcpToolDefinition[],
    name: string,
  ): StandardMcpToolDefinition | undefined {
    const exact = tools.find((tool) => tool.name === name);
    if (this.config.exposeNamespace === false) return exact;

    const prefix = `mcp__${sanitize(this.namespace())}__`;
    if (!name.startsWith(prefix)) return exact;

    const sanitized = name.slice(prefix.length);
    return tools.find((tool) => sanitize(tool.name) === sanitized);
  }

  private namespace(): string {
    return this.config.namespace ?? DEFAULT_AGENTIC_MCP_CONFIG.namespace;
  }
}

/** Whether a `callTool` result is the server reporting the tool failed. */
function isErrorResult(result: unknown): boolean {
  return (
    !!result &&
    typeof result === 'object' &&
    (result as { isError?: unknown }).isError === true
  );
}

/** The text a failed tool returned, or a generic message when it has none. */
function errorText(result: unknown): string {
  const content = (result as { content?: unknown }).content;
  const text = Array.isArray(content)
    ? content
        .filter(
          (block): block is { type: 'text'; text: string } =>
            !!block && block.type === 'text' && typeof block.text === 'string',
        )
        .map((block) => block.text)
        .join('\n')
    : '';
  return text || 'Tool execution failed';
}

function sanitize(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_');
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2) ?? 'null';
  } catch {
    return String(value);
  }
}
