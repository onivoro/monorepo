import type {
  ServerCapabilities,
  ServerOptions,
} from '@modelcontextprotocol/server';
import type { McpServerMetadata } from './mcp-server-metadata';

/**
 * The capability keys the module builds from the registry (`buildCapabilities`). The
 * module also sends the notifications they promise, so they are its alone.
 */
export type McpModuleCapabilityKey =
  | 'logging'
  | 'tools'
  | 'resources'
  | 'prompts';

/** Capabilities a caller may add to the ones the module builds. */
export type McpExtraCapabilities = Omit<
  ServerCapabilities,
  McpModuleCapabilityKey
>;

/** What `McpHttpModule` and `McpStdioModule` both need to build an `McpServer`. */
export interface McpServerBaseConfig {
  metadata: McpServerMetadata;
  /**
   * Passed to `McpServer`. The module sets `capabilities`, and `instructions` when
   * `metadata.instructions` is set.
   */
  serverOptions?: ServerOptions;
  /**
   * Capabilities to advertise next to the ones the module builds from the registry: for
   * example `experimental: { 'claude/channel': {} }` for a Claude Code channel. The keys the
   * module builds (`logging`, `tools`, `resources`, `prompts`) are left out of the type and
   * ignored at runtime, because the module decides what it sends for them. Advertise only
   * what your server handles.
   */
  capabilities?: McpExtraCapabilities;
}
