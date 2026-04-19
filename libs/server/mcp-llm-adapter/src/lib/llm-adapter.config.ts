import type { McpToolMetadata } from '@onivoro/server-mcp';

export const LLM_ADAPTER_CONFIG = Symbol('LLM_ADAPTER_CONFIG');

export interface LlmAdapterConfig<T = unknown> {
  aliasKey: string;
  sanitizeName?: (name: string) => string;
  formatTool: (
    name: string,
    description: string,
    jsonSchema: Record<string, unknown>,
  ) => T;
}

export function resolveProviderName(
  metadata: McpToolMetadata,
  config: LlmAdapterConfig,
): string {
  const alias = metadata.aliases?.[config.aliasKey];
  if (alias) return alias;
  return config.sanitizeName
    ? config.sanitizeName(metadata.name)
    : metadata.name;
}
