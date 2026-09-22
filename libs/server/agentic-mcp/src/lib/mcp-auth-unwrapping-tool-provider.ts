import {
  AgenticToolCall,
  AgenticToolDefinition,
  AgenticToolExecutionContext,
  AgenticToolExecutionResult,
} from '@onivoro/isomorphic-agentic';
import { McpAuthInfo } from '@onivoro/server-mcp';
import { McpRegistryAgenticToolProvider } from './mcp-registry-agentic-tool-provider.service';

export interface McpAuthUnwrappingOptions<TAuthContext> {
  authUnavailableCode: string;
  authUnavailableMessage: string;
  getError?: (authContext: TAuthContext | undefined) => string | undefined;
  getMcpAuthInfo: (authContext: TAuthContext) => McpAuthInfo | undefined;
  isAuthContext: (value: unknown) => value is TAuthContext;
}

export async function listMcpAuthWrappedTools<TAuthContext>(
  delegate: McpRegistryAgenticToolProvider,
  context: AgenticToolExecutionContext,
  options: McpAuthUnwrappingOptions<TAuthContext>,
): Promise<AgenticToolDefinition[]> {
  const authContext = options.isAuthContext(context.authInfo)
    ? context.authInfo
    : undefined;
  const mcpAuthInfo = authContext && options.getMcpAuthInfo(authContext);

  if (!mcpAuthInfo) return [];

  return delegate.listTools({ ...context, authInfo: mcpAuthInfo });
}

export async function executeMcpAuthWrappedTool<TAuthContext>(
  delegate: McpRegistryAgenticToolProvider,
  call: AgenticToolCall,
  context: AgenticToolExecutionContext,
  options: McpAuthUnwrappingOptions<TAuthContext>,
): Promise<AgenticToolExecutionResult> {
  const authContext = options.isAuthContext(context.authInfo)
    ? context.authInfo
    : undefined;
  const mcpAuthInfo = authContext && options.getMcpAuthInfo(authContext);

  if (!mcpAuthInfo) {
    const message =
      options.getError?.(authContext) ?? options.authUnavailableMessage;
    return {
      toolCallId: call.id,
      name: call.name,
      isError: true,
      result: { code: options.authUnavailableCode, message },
      resultText: message,
    };
  }

  const delegatedContext = { ...context, authInfo: mcpAuthInfo };
  const tools = await delegate.listTools(delegatedContext);
  const tool = tools.find(
    (registeredTool) => registeredTool.name === call.name,
  );

  if (!tool) {
    const message = `Unknown MCP tool: ${call.name}`;
    return {
      toolCallId: call.id,
      name: call.name,
      isError: true,
      result: { code: 'mcp_tool_unknown', message },
      resultText: message,
    };
  }

  return delegate.executeTool(
    normalizeToolCall({ ...call, name: tool.name }),
    delegatedContext,
  );
}

function normalizeToolCall(call: AgenticToolCall): AgenticToolCall {
  return {
    ...call,
    input: normalizeToolInput(call.input),
  };
}

function normalizeToolInput(input: unknown): unknown {
  if (input === undefined) return undefined;

  try {
    return JSON.parse(JSON.stringify(input));
  } catch {
    throw new Error('MCP tool input must be JSON serializable.');
  }
}
