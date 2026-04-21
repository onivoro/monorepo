import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { McpToolRegistry, McpAuthInfo, mcpSchemaToJsonSchema } from '@onivoro/server-mcp';
import {
  LLM_ADAPTER_CONFIG,
  LlmAdapterConfig,
  resolveProviderName,
} from './llm-adapter.config';

@Injectable()
export class LlmToolAdapter<T = unknown> implements OnModuleInit {
  private nameMapCache: Map<string, string> | null = null;
  private unsubscribe?: () => void;

  constructor(
    private readonly registry: McpToolRegistry,
    @Inject(LLM_ADAPTER_CONFIG)
    private readonly config: LlmAdapterConfig<T>,
  ) {}

  onModuleInit() {
    this.unsubscribe = this.registry.onRegistrationChange(() => {
      this.nameMapCache = null;
    });
  }

  private getNameMap(): Map<string, string> {
    if (!this.nameMapCache) {
      const map = new Map<string, string>();
      for (const { metadata } of this.registry.getTools()) {
        map.set(resolveProviderName(metadata, this.config), metadata.name);
      }
      this.nameMapCache = map;
    }
    return this.nameMapCache;
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
    return this.getNameMap().get(providerName);
  }

  async executeToolForProvider(
    providerName: string,
    params: Record<string, unknown>,
    authInfo?: McpAuthInfo,
  ): Promise<string> {
    const mcpName = this.getNameMap().get(providerName);
    if (!mcpName) {
      throw new Error(
        `No MCP tool found for provider name "${providerName}".`,
      );
    }
    const result = await this.registry.executeToolRaw(mcpName, params, authInfo);
    return typeof result === 'string' ? result : JSON.stringify(result);
  }
}
