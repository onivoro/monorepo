import { AgenticConversation, AgenticRun } from './agentic-conversation.types';
import { AgenticMessage } from './agentic-message.types';
import { AgenticDeltaField, AgenticPart } from './agentic-part.types';

export type AgenticEvent =
  | AgenticConversationUpsertEvent
  | AgenticMessageUpsertEvent
  | AgenticMessageRemoveEvent
  | AgenticMessagePartUpsertEvent
  | AgenticMessagePartDeltaEvent
  | AgenticRunUpsertEvent
  | AgenticRunErrorEvent;

export interface AgenticConversationUpsertEvent {
  type: 'conversation.upsert';
  conversation: AgenticConversation;
}

export interface AgenticMessageUpsertEvent {
  type: 'message.upsert';
  conversationId: string;
  message: AgenticMessage;
}

export interface AgenticMessageRemoveEvent {
  type: 'message.remove';
  conversationId: string;
  messageId: string;
}

export interface AgenticMessagePartUpsertEvent {
  type: 'message.part.upsert';
  conversationId: string;
  messageId: string;
  part: AgenticPart;
}

export interface AgenticMessagePartDeltaEvent {
  type: 'message.part.delta';
  conversationId: string;
  messageId: string;
  partId: string;
  field: AgenticDeltaField;
  delta: string;
}

export interface AgenticRunUpsertEvent {
  type: 'run.upsert';
  conversationId: string;
  run: AgenticRun;
}

export interface AgenticRunErrorEvent {
  type: 'run.error';
  conversationId: string;
  runId: string;
  message: string;
  retryable?: boolean;
}
