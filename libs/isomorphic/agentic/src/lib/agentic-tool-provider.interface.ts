import {
  AgenticProviderMetadata,
  JsonObject,
  JsonSchemaObject,
} from './json.types';

export interface AgenticToolDefinition {
  name: string;
  description?: string;
  inputSchema: JsonSchemaObject;
  providerMetadata?: AgenticProviderMetadata;
}

export interface AgenticToolCall {
  id: string;
  name: string;
  input: unknown;
  providerMetadata?: AgenticProviderMetadata;
}

export interface AgenticToolExecutionContext {
  conversationId: string;
  runId: string;
  userId?: string;
  sessionId?: string;
  authInfo?: unknown;
  signal?: AbortSignal;
  metadata?: JsonObject;
  sendProgress?: (
    progress: number,
    total?: number,
    message?: string,
  ) => Promise<void>;
  sendLog?: (level: string, data: unknown, logger?: string) => Promise<void>;
}

export interface AgenticToolExecutionResult {
  toolCallId: string;
  name: string;
  result: unknown;
  resultText?: string;
  isError?: boolean;
  providerMetadata?: AgenticProviderMetadata;
}

export interface AgenticToolProvider {
  listTools(
    context: AgenticToolExecutionContext,
  ): Promise<AgenticToolDefinition[]>;
  executeTool(
    call: AgenticToolCall,
    context: AgenticToolExecutionContext,
  ): Promise<AgenticToolExecutionResult>;
}
