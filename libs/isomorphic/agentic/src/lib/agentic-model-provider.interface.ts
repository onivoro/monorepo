import { AgenticMessage } from './agentic-message.types';
import { AgenticModelEvent } from './agentic-model-event.types';
import { AgenticToolDefinition } from './agentic-tool-provider.interface';
import { JsonObject } from './json.types';

export interface AgenticModelRequest {
  conversationId: string;
  runId: string;
  messages: AgenticMessage[];
  system?: string;
  tools?: AgenticToolDefinition[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stepIndex?: number;
  signal?: AbortSignal;
  metadata?: JsonObject;
}

export interface AgenticModelProvider {
  readonly provider: string;
  readonly model: string;

  stream(request: AgenticModelRequest): AsyncIterable<AgenticModelEvent>;

  complete?(request: AgenticModelRequest): Promise<AgenticMessage>;
}
