import { AgenticToolDefinition } from '@onivoro/isomorphic-agentic';
import type { LlmAdapterConfig } from '@onivoro/server-mcp-llm-adapter';
import { AgenticToolInputContextConfig } from './agentic-tool-input-context';

export const AGENTIC_MCP_CONFIG = 'AGENTIC_MCP_CONFIG';

export interface AgenticMcpConfig {
  /** Namespace reported in providerMetadata, for tracing which server a tool came from. */
  namespace?: string;

  /** Prefix exposed tool names with the namespace. */
  exposeNamespace?: boolean;

  /** How conversation metadata may fill in declared tool arguments. */
  inputContext?: AgenticToolInputContextConfig;
}

export const DEFAULT_AGENTIC_MCP_CONFIG: Required<
  Pick<AgenticMcpConfig, 'namespace' | 'exposeNamespace'>
> = {
  namespace: 'mcp',
  exposeNamespace: true,
};

/**
 * Formats registry tools into the agentic contract's own shape.
 *
 * This is an ordinary `LlmAdapterConfig`, so the agentic loop is just one more
 * consumer of the adapter alongside Claude, Bedrock Converse and the rest --
 * and it inherits alias resolution and name sanitization for free.
 */
export function agenticLlmAdapterConfig(
  config: AgenticMcpConfig = {},
): LlmAdapterConfig<AgenticToolDefinition> {
  const namespace = config.namespace ?? DEFAULT_AGENTIC_MCP_CONFIG.namespace;
  const expose =
    config.exposeNamespace ?? DEFAULT_AGENTIC_MCP_CONFIG.exposeNamespace;

  return {
    aliasKey: 'agentic',
    sanitizeName: (name) => {
      const safe = sanitize(name);
      return expose ? `mcp__${sanitize(namespace)}__${safe}` : safe;
    },
    formatTool: (name, description, jsonSchema) => ({
      name,
      description,
      inputSchema: jsonSchema,
      providerMetadata: { mcp: { namespace } },
    }),
  };
}

function sanitize(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_');
}
