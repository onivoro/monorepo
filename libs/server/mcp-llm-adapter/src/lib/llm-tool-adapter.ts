import { Inject, Injectable } from '@nestjs/common';
import { McpToolRegistry, mcpSchemaToJsonSchema } from '@onivoro/server-mcp';
import {
  LLM_ADAPTER_CONFIG,
  LlmAdapterConfig,
  resolveProviderName,
} from './llm-adapter.config';

@Injectable()
export class LlmToolAdapter<T = unknown> {
  constructor(
    private readonly registry: McpToolRegistry,
    @Inject(LLM_ADAPTER_CONFIG)
    private readonly config: LlmAdapterConfig<T>,
  ) {}

  private buildNameMap(): Map<string, string> {
    const map = new Map<string, string>();
    for (const { metadata } of this.registry.getTools()) {
      map.set(resolveProviderName(metadata, this.config), metadata.name);
    }
    return map;
  }

  toProviderTools(): T[] {
    return this.registry.getTools().map(({ metadata }) =>
      this.config.formatTool(
        resolveProviderName(metadata, this.config),
        metadata.description,
        mcpSchemaToJsonSchema(metadata.schema),
      ),
    );
  }

  resolveProviderToolName(providerName: string): string | undefined {
    return this.buildNameMap().get(providerName);
  }

  async executeToolForProvider(
    providerName: string,
    params: Record<string, unknown>,
  ): Promise<string> {
    const mcpName = this.buildNameMap().get(providerName);
    if (!mcpName) {
      throw new Error(
        `No MCP tool found for provider name "${providerName}".`,
      );
    }
    const result = await this.registry.executeToolRaw(mcpName, params);
    return typeof result === 'string' ? result : JSON.stringify(result);
  }
}
