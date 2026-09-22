import { AgenticEvent } from './agentic-event.types';

export interface AgenticEventContext {
  conversationId: string;
  runId?: string;
  userId?: string;
  sessionId?: string;
}

export interface AgenticEventPublisher {
  publish(event: AgenticEvent, context: AgenticEventContext): Promise<void>;
  publishMany?(
    events: AgenticEvent[],
    context: AgenticEventContext,
  ): Promise<void>;
}
