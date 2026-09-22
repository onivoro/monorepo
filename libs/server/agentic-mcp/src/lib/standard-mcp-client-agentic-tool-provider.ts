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
  listTools(): Promise<{ tools: StandardMcpToolDefinition[] }>;
  callTool(
    params: {
      name: string;
      arguments?: Record<string, unknown>;
    },
    ...rest: unknown[]
  ): Promise<unknown>;
}

export class StandardMcpClientAgenticToolProvider
  implements AgenticToolProvider
{
  constructor(
    private readonly client: StandardMcpClientLike,
    private readonly config: AgenticMcpConfig = {},
  ) {}

  async listTools(
    _context?: AgenticToolExecutionContext,
  ): Promise<AgenticToolDefinition[]> {
    const result = await this.client.listTools();
    return result.tools.map((tool) => ({
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

    return {
      toolCallId: call.id,
      name: call.name,
      result,
      resultText: stringifyUnknown(result),
      providerMetadata: {
        mcp: {
          originalName,
          namespace: this.namespace(),
          client: 'standard',
        },
      },
    };
  }

  private exposeName(name: string): string {
    if (this.config.exposeNamespace === false) return name;
    return `mcp__${sanitize(this.namespace())}__${sanitize(name)}`;
  }

  private async originalTool(name: string): Promise<StandardMcpToolDefinition> {
    const result = await this.client.listTools();
    if (this.config.exposeNamespace === false) {
      return result.tools.find((tool) => tool.name === name) ?? { name };
    }

    const prefix = `mcp__${sanitize(this.namespace())}__`;
    if (!name.startsWith(prefix)) {
      return result.tools.find((tool) => tool.name === name) ?? { name };
    }

    const sanitized = name.slice(prefix.length);
    const match = result.tools.find(
      (tool) => sanitize(tool.name) === sanitized,
    );
    return match ?? { name: sanitized };
  }

  private namespace(): string {
    return this.config.namespace ?? DEFAULT_AGENTIC_MCP_CONFIG.namespace;
  }
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
