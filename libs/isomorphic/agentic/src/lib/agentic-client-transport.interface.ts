import { AgenticEvent } from './agentic-event.types';
import { JsonObject } from './json.types';

export interface AgenticSendUserInput {
  conversationId: string;
  text: string;
  metadata?: JsonObject;
}

export interface AgenticClientTransport {
  subscribe(
    conversationId: string,
    onEvent: (event: AgenticEvent) => void,
  ): () => void;
  send(input: AgenticSendUserInput): Promise<void>;
  abort(runId: string): Promise<void>;
}
