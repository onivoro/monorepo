import { AGENTIC_TOOL_PROVIDER } from '@onivoro/server-agentic';
import { DynamicModule, Module } from '@nestjs/common';
import { McpRegistryModule, McpToolRegistry } from '@onivoro/server-mcp';
import {
  LLM_ADAPTER_CONFIG,
  McpLlmToolAdapter,
} from '@onivoro/server-mcp-llm-adapter';
import {
  AGENTIC_MCP_CONFIG,
  AgenticMcpConfig,
  agenticLlmAdapterConfig,
} from './agentic-mcp-config';
import { McpRegistryAgenticToolProvider } from './mcp-registry-agentic-tool-provider.service';

@Module({})
export class AgenticMcpModule {
  /**
   * `imports` supplies `McpToolRegistry`, and defaults to this package owning
   * one.
   *
   * It is a parameter rather than a fixed import because the registry is not
   * global: a host that also serves MCP over HTTP already has one, and letting
   * this module create a second would split the catalogue silently — tools
   * registered once would appear to only one of the two consumers. Such a host
   * passes the module that exports its registry instead.
   */
  static configure(
    config: AgenticMcpConfig = {},
    imports: DynamicModule['imports'] = [McpRegistryModule.registerOnly()],
  ): DynamicModule {
    return {
      module: AgenticMcpModule,
      imports,
      providers: [
        { provide: AGENTIC_MCP_CONFIG, useValue: config },
        {
          provide: LLM_ADAPTER_CONFIG,
          useValue: agenticLlmAdapterConfig(config),
        },
        {
          provide: McpLlmToolAdapter,
          useFactory: (registry: McpToolRegistry) =>
            new McpLlmToolAdapter(registry, agenticLlmAdapterConfig(config)),
          inject: [McpToolRegistry],
        },
        McpRegistryAgenticToolProvider,
        {
          provide: AGENTIC_TOOL_PROVIDER,
          useExisting: McpRegistryAgenticToolProvider,
        },
      ],
      exports: [
        AGENTIC_MCP_CONFIG,
        McpLlmToolAdapter,
        McpRegistryAgenticToolProvider,
        AGENTIC_TOOL_PROVIDER,
      ],
    };
  }
}
