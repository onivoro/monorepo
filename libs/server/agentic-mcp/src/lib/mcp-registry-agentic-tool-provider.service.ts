import {
  AgenticToolCall,
  AgenticToolDefinition,
  AgenticToolExecutionContext,
  AgenticToolExecutionResult,
  AgenticToolProvider,
} from '@onivoro/isomorphic-agentic';
import { Inject, Injectable } from '@nestjs/common';
import { McpAuthInfo } from '@onivoro/server-mcp';
import { McpLlmToolAdapter } from '@onivoro/server-mcp-llm-adapter';
import {
  AGENTIC_MCP_CONFIG,
  AgenticMcpConfig,
  DEFAULT_AGENTIC_MCP_CONFIG,
} from './agentic-mcp-config';
import { normalizeAgenticToolInputFromContext } from './agentic-tool-input-context';

/**
 * Exposes the MCP tool registry to an agentic run loop.
 *
 * The name mapping, schema conversion and execution all belong to
 * `McpLlmToolAdapter`; this adds the two things the loop needs and the adapter
 * has no opinion about -- the per-execution context (abort signal, progress and
 * log channels, session id) and filling declared arguments from conversation
 * metadata.
 */
@Injectable()
export class McpRegistryAgenticToolProvider implements AgenticToolProvider {
  constructor(
    private readonly adapter: McpLlmToolAdapter<AgenticToolDefinition>,
    @Inject(AGENTIC_MCP_CONFIG)
    private readonly config: AgenticMcpConfig,
  ) {}

  async listTools(
    _context?: AgenticToolExecutionContext,
  ): Promise<AgenticToolDefinition[]> {
    return this.adapter.toProviderTools();
  }

  async executeTool(
    call: AgenticToolCall,
    context: AgenticToolExecutionContext,
  ): Promise<AgenticToolExecutionResult> {
    const result = await this.adapter.executeToolCallForProvider(
      {
        providerName: call.name,
        params: normalizeAgenticToolInputFromContext(
          call.input,
          context.metadata,
          this.inputSchemaFor(call.name),
          this.config.inputContext,
        ),
        id: call.id,
      },
      context.authInfo as McpAuthInfo | undefined,
      {
        sessionId: context.sessionId,
        signal: context.signal,
        sendProgress: context.sendProgress,
        sendLog: context.sendLog,
      },
    );

    const providerMetadata = {
      mcp: {
        originalName: this.adapter.resolveProviderToolName(call.name),
        namespace: this.namespace(),
      },
    };

    // A failed tool is a result the model must see and react to, not an
    // exception that ends the run.
    if (!result.success) {
      return {
        toolCallId: call.id,
        name: call.name,
        result: result.error,
        resultText: result.error ?? 'Tool execution failed',
        isError: true,
        providerMetadata,
      };
    }

    return {
      toolCallId: call.id,
      name: call.name,
      result: result.result,
      resultText: result.result,
      providerMetadata,
    };
  }

  private inputSchemaFor(
    providerName: string,
  ): Record<string, unknown> | undefined {
    const tool = this.adapter
      .toProviderTools()
      .find((candidate) => candidate.name === providerName);
    return tool?.inputSchema;
  }

  private namespace(): string {
    return this.config.namespace ?? DEFAULT_AGENTIC_MCP_CONFIG.namespace;
  }
}
