// Modules
export { McpHttpModule } from './lib/mcp-http.module';
export { McpStdioModule } from './lib/mcp-stdio.module';
export { McpRegistryModule } from './lib/mcp-registry.module';

// Services
export { McpHttpService } from './lib/mcp-http.service';
export { McpToolRegistry } from './lib/mcp-tool-registry';
export { McpScopeGuard } from './lib/mcp-scope-guard';

// Decorators
export { McpTool } from './lib/mcp-tool.decorator';
export { McpResource } from './lib/mcp-resource.decorator';
export { McpPrompt } from './lib/mcp-prompt.decorator';
export { McpGuard } from './lib/mcp-guard.decorator';

// Injection tokens
export { MCP_MODULE_CONFIG } from './lib/mcp-module-config-token';
export { MCP_STDIO_CONFIG } from './lib/mcp-stdio-config-token';
export { MCP_TOOL_METADATA } from './lib/mcp-tool-metadata-token';
export { MCP_RESOURCE_METADATA } from './lib/mcp-resource-metadata-token';
export { MCP_PROMPT_METADATA } from './lib/mcp-prompt-metadata-token';
export { MCP_GUARD_METADATA } from './lib/mcp-guard-metadata-token';

// CORS constants
export { MCP_CORS_ALLOWED_HEADERS } from './lib/mcp-cors-allowed-headers';
export { MCP_CORS_EXPOSED_HEADERS } from './lib/mcp-cors-exposed-headers';
export { MCP_CORS_METHODS } from './lib/mcp-cors-methods';
export { MCP_CORS_CONFIG } from './lib/mcp-cors-config';

// Config interfaces
export { McpModuleConfig } from './lib/mcp-module-config';
export { McpModuleAsyncOptions } from './lib/mcp-module-async-options';
export { McpServerMetadata } from './lib/mcp-server-metadata';
export { McpStdioConfig } from './lib/mcp-stdio-config';
export { McpStdioAsyncOptions } from './lib/mcp-stdio-async-options';

// Tool metadata & options
export { McpToolMetadata } from './lib/mcp-tool-metadata';
export { McpToolOptions } from './lib/mcp-tool-options';
export { McpToolAnnotations } from './lib/mcp-tool-annotations';
export { McpIcon } from './lib/mcp-icon';

// Resource & prompt metadata
export { McpResourceAnnotations } from './lib/mcp-resource-annotations';
export { McpResourceMetadata } from './lib/mcp-resource-metadata';
export { McpPromptMetadata } from './lib/mcp-prompt-metadata';

// Auth & guards
export { McpAuthInfo } from './lib/mcp-auth-info';
export { McpAuthProvider } from './lib/mcp-auth-provider';
export { McpCanActivate } from './lib/mcp-can-activate';
export { McpGuardMetadata } from './lib/mcp-guard-metadata';

// Tool context & interceptors
export { McpToolContext } from './lib/mcp-tool-context';
export { McpToolInterceptor } from './lib/mcp-tool-interceptor';
export { McpLogLevel } from './lib/mcp-log-level';

// Content types & results
export { McpToolResult } from './lib/mcp-tool-result';
export { McpContentBlock } from './lib/mcp-content-block';
export { McpTextContent } from './lib/mcp-text-content';
export { McpImageContent } from './lib/mcp-image-content';
export { McpAudioContent } from './lib/mcp-audio-content';
export { McpEmbeddedResource } from './lib/mcp-embedded-resource';
export { McpResourceLink } from './lib/mcp-resource-link';

// Registration & subscriptions
export { McpRegistrationChangeType } from './lib/mcp-registration-change-type';
export { McpRegistrationChangeListener } from './lib/mcp-registration-change-listener';
export { McpResourceUpdateListener } from './lib/mcp-resource-update-listener';

// Provider interfaces
export { McpResourceListProvider } from './lib/mcp-resource-list-provider';
export { McpCompletionProvider } from './lib/mcp-completion-provider';

// Schema utilities
export { mcpSchemaToJsonSchema } from './lib/mcp-schema-converters';

// Wiring utilities
export { wireRegistryToServer } from './lib/wire-registry-to-server';
export { buildCapabilities } from './lib/build-capabilities';

// Re-exported SDK types
export type { EventStore, StreamId, EventId } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
