import { AGENTIC_TOOL_PROVIDER } from '@onivoro/server-agentic';
import { DynamicModule, Module } from '@nestjs/common';
import { McpToolRegistry } from '@onivoro/server-mcp';
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
  static configure(config: AgenticMcpConfig = {}): DynamicModule {
    return {
      module: AgenticMcpModule,
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
