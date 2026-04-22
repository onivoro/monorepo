import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { McpToolRegistry, McpAuthInfo, mcpSchemaToJsonSchema } from '@onivoro/server-mcp';
import {
  LLM_ADAPTER_CONFIG,
  LlmAdapterConfig,
  resolveProviderName,
} from './llm-adapter.config';

/** A single tool call in a batch request. */
export interface ProviderToolCall {
  /** Tool name as returned by the LLM provider (may be sanitized/aliased). */
  providerName: string;
  /** Parameters for the tool call. */
  params: Record<string, unknown>;
  /** Optional identifier from the provider (e.g. OpenAI tool_call.id, Claude tool_use.id, Bedrock toolUseId). Pass-through for correlation. */
  id?: string;
}

/** Result of a single tool call in a batch. */
export interface ProviderToolCallResult {
  /** The provider-specific tool name that was called. */
  providerName: string;
  /** Pass-through of the id from the input, if provided. */
  id?: string;
  /** Stringified result on success, undefined on error. */
  result?: string;
  /** Error message on failure, undefined on success. */
  error?: string;
  /** Whether this call succeeded. */
  success: boolean;
}

@Injectable()
export class McpLlmToolAdapter<T = unknown> implements OnModuleInit {
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
    return this.registry.getTools().map(({ metadata }) => {
      const name = resolveProviderName(metadata, this.config);
      const inputSchema = mcpSchemaToJsonSchema(metadata.schema);

      if (this.config.formatToolWithOutput && metadata.outputSchema) {
        const outputSchema = mcpSchemaToJsonSchema(metadata.outputSchema);
        return this.config.formatToolWithOutput(name, metadata.description, inputSchema, outputSchema);
      }

      return this.config.formatTool(name, metadata.description, inputSchema);
    });
  }

  /**
   * Returns a map of provider tool names to their converted output JSON Schemas.
   * Only includes tools that have an `outputSchema` defined in their MCP metadata.
   * Useful for constructing provider-level structured output configs (e.g. OpenAI `response_format`).
   */
  getOutputSchemas(): Map<string, Record<string, unknown>> {
    const result = new Map<string, Record<string, unknown>>();
    for (const { metadata } of this.registry.getTools()) {
      if (metadata.outputSchema) {
        const providerName = resolveProviderName(metadata, this.config);
        result.set(providerName, mcpSchemaToJsonSchema(metadata.outputSchema));
      }
    }
    return result;
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

  /** Execute a single tool call, returning the full result with id passthrough. */
  async executeToolCallForProvider(
    toolCall: ProviderToolCall,
    authInfo?: McpAuthInfo,
  ): Promise<ProviderToolCallResult> {
    const [result] = await this.executeToolsForProvider([toolCall], authInfo);
    return result;
  }

  async executeToolsForProvider(
    toolCalls: ProviderToolCall[],
    authInfo?: McpAuthInfo,
  ): Promise<ProviderToolCallResult[]> {
    const nameMap = this.getNameMap();

    const settled = await Promise.allSettled(
      toolCalls.map(async ({ providerName, params, id }) => {
        const mcpName = nameMap.get(providerName);
        if (!mcpName) {
          throw new Error(`No MCP tool found for provider name "${providerName}".`);
        }
        const rawResult = await this.registry.executeToolRaw(mcpName, params, authInfo);
        const result = typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult);
        return { providerName, id, result, success: true } as ProviderToolCallResult;
      }),
    );

    return settled.map((outcome, i) => {
      if (outcome.status === 'fulfilled') {
        return outcome.value;
      }
      const call = toolCalls[i];
      return {
        providerName: call.providerName,
        id: call.id,
        error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
        success: false,
      };
    });
  }
}
