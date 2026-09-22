import { AgenticUsage } from './agentic-usage.types';
import { JsonObject } from './json.types';

export type AgenticConversationStatus = 'active' | 'archived' | 'deleted';

export interface AgenticConversation {
  id: string;
  title?: string;
  status: AgenticConversationStatus;
  participantIds?: string[];
  latestSummaryMessageId?: string;
  metadata?: JsonObject;
  createdAt: string;
  updatedAt: string;
}

export interface AgenticConversationListOptions {
  limit?: number;
  participantId?: string;
  search?: string;
  status?: AgenticConversationStatus;
  resourceType?: string;
  resourceId?: string;
}

export interface AgenticConversationListItem extends AgenticConversation {
  messageCount?: number;
  lastMessageAt?: string;
  preview?: string;
}

export type AgenticRunStatus =
  | 'queued'
  | 'running'
  | 'complete'
  | 'error'
  | 'aborted';

export interface AgenticRun {
  id: string;
  conversationId: string;
  status: AgenticRunStatus;
  userMessageId?: string;
  assistantMessageId?: string;
  model?: string;
  provider?: string;
  usage?: AgenticUsage;
  errorMessage?: string;
  metadata?: JsonObject;
  startedAt: string;
  completedAt?: string;
  updatedAt: string;
}

export interface AgenticConversationSummary {
  id: string;
  conversationId: string;
  summaryMessageId: string;
  startMessageId: string;
  endMessageId: string;
  tokenCount?: number;
  createdAt: string;
  metadata?: JsonObject;
}
