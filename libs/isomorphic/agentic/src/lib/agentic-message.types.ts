import { AgenticPart } from './agentic-part.types';
import { AgenticUsage } from './agentic-usage.types';
import { JsonObject } from './json.types';

export type AgenticRole = 'system' | 'user' | 'assistant' | 'tool' | 'summary';

export type AgenticMessageStatus =
  | 'pending'
  | 'streaming'
  | 'complete'
  | 'error'
  | 'aborted';

export interface AgenticMessage {
  id: string;
  conversationId: string;
  role: AgenticRole;
  status: AgenticMessageStatus;
  parts: AgenticPart[];
  parentMessageId?: string;
  runId?: string;
  model?: string;
  provider?: string;
  compactedAt?: string;
  usage?: AgenticUsage;
  metadata?: JsonObject;
  createdAt: string;
  updatedAt: string;
}

export interface AgenticCreateMessageInput
  extends Omit<AgenticMessage, 'createdAt' | 'updatedAt'> {
  createdAt?: string;
  updatedAt?: string;
}
