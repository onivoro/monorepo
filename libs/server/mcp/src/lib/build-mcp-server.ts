import type { Logger } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/server';
import {
  buildCapabilities,
  MODULE_CAPABILITY_KEYS,
} from './build-capabilities';
import type { McpServerBaseConfig } from './mcp-server-base-config';
import type { McpToolRegistry } from './mcp-tool-registry';

/**
 * Builds an `McpServer` from a module config: its metadata, `serverOptions`, and the
 * capabilities built from the registry plus the config's own.
 */
export function buildMcpServer(
  config: McpServerBaseConfig,
  registry: McpToolRegistry,
  capabilityOptions?: { logging?: boolean; notifications?: boolean },
): McpServer {
  return new McpServer(
    {
      name: config.metadata.name,
      version: config.metadata.version,
      ...(config.metadata.description && {
        description: config.metadata.description,
      }),
    },
    {
      ...config.serverOptions,
      capabilities: buildCapabilities(registry, {
        ...capabilityOptions,
        extra: config.capabilities,
      }),
      ...(config.metadata.instructions && {
        instructions: config.metadata.instructions,
      }),
    },
  );
}

/** Warns, once at startup, about configured capabilities the module ignores. */
export function warnAboutIgnoredCapabilities(
  config: McpServerBaseConfig,
  logger: Pick<Logger, 'warn'>,
): void {
  const ignored = Object.keys(config.capabilities ?? {}).filter((key) =>
    (MODULE_CAPABILITY_KEYS as readonly string[]).includes(key),
  );
  if (ignored.length === 0) return;
  logger.warn(
    `Ignoring capabilities.${ignored.join(', capabilities.')}: the module builds ` +
      'these from the registry and sends the notifications they promise.',
  );
}
