import type { McpTextContent } from './mcp-text-content';
import type { McpImageContent } from './mcp-image-content';
import type { McpAudioContent } from './mcp-audio-content';
import type { McpEmbeddedResource } from './mcp-embedded-resource';
import type { McpResourceLink } from './mcp-resource-link';

export type McpContentBlock =
  | McpTextContent
  | McpImageContent
  | McpAudioContent
  | McpEmbeddedResource
  | McpResourceLink;
