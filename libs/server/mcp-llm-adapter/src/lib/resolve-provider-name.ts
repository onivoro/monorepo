import type { McpToolMetadata } from '@onivoro/server-mcp';
import type { LlmAdapterConfig } from './llm-adapter-config';

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
