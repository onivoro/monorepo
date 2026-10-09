import { Injectable } from '@nestjs/common';
import {
  AgenticToolCall,
  AgenticToolDefinition,
  AgenticToolExecutionContext,
  AgenticToolExecutionResult,
  AgenticToolProvider,
} from '@onivoro/isomorphic-agentic';
import { agenticMcpAuthUnwrappingOptions } from './agentic-mcp-auth';
import {
  executeMcpAuthWrappedTool,
  listMcpAuthWrappedTools,
} from './mcp-auth-unwrapping-tool-provider';
import { McpRegistryAgenticToolProvider } from './mcp-registry-agentic-tool-provider.service';

/**
 * Serves the registry's tools to runs whose `authInfo` is an
 * `AgenticMcpAuthContext` from `resolveAgenticMcpAuth()`, unwrapping it with
 * `agenticMcpAuthUnwrappingOptions` before delegating to
 * `McpRegistryAgenticToolProvider`.
 *
 * Apps bind it as their tool provider
 * (`{ provide: AGENTIC_TOOL_PROVIDER, useExisting: AgenticMcpAuthToolProvider }`).
 * Subclasses can filter `super.listTools()` or check before
 * `super.executeTool()`, e.g. by fields apps add to the context such as
 * `actionIds`.
 */
@Injectable()
export class AgenticMcpAuthToolProvider implements AgenticToolProvider {
  constructor(protected readonly delegate: McpRegistryAgenticToolProvider) {}

  async listTools(
    context: AgenticToolExecutionContext,
  ): Promise<AgenticToolDefinition[]> {
    return listMcpAuthWrappedTools(
      this.delegate,
      context,
      agenticMcpAuthUnwrappingOptions,
    );
  }

  async executeTool(
    call: AgenticToolCall,
    context: AgenticToolExecutionContext,
  ): Promise<AgenticToolExecutionResult> {
    return executeMcpAuthWrappedTool(
      this.delegate,
      call,
      context,
      agenticMcpAuthUnwrappingOptions,
    );
  }
}
