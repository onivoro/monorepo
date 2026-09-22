import {
  AgenticConversation,
  AgenticConversationListOptions,
  AgenticConversationSummary,
  AgenticRun,
} from './agentic-conversation.types';
import { AgenticMessage } from './agentic-message.types';
import { AgenticDeltaField, AgenticPart } from './agentic-part.types';
import { AgenticPrompt } from './agentic-prompt.types';
import { AgenticUsage } from './agentic-usage.types';

export interface AgenticMessageListOptions {
  limit?: number;
  beforeMessageId?: string;
  afterMessageId?: string;
  includeCompacted?: boolean;
}

export interface AgenticConversationRepository {
  create(conversation: AgenticConversation): Promise<AgenticConversation>;
  get(conversationId: string): Promise<AgenticConversation | undefined>;
  update(conversation: AgenticConversation): Promise<AgenticConversation>;
  list?(
    options?: AgenticConversationListOptions,
  ): Promise<AgenticConversation[]>;
}

export interface AgenticMessageRepository {
  create(message: AgenticMessage): Promise<AgenticMessage>;
  update(message: AgenticMessage): Promise<AgenticMessage>;
  get(
    conversationId: string,
    messageId: string,
  ): Promise<AgenticMessage | undefined>;
  listByConversationId(
    conversationId: string,
    options?: AgenticMessageListOptions,
  ): Promise<AgenticMessage[]>;
  upsertPart(
    conversationId: string,
    messageId: string,
    part: AgenticPart,
  ): Promise<void>;
  appendPartDelta(
    conversationId: string,
    messageId: string,
    partId: string,
    field: AgenticDeltaField,
    delta: string,
  ): Promise<void>;
}

export interface AgenticRunRepository {
  create(run: AgenticRun): Promise<AgenticRun>;
  update(run: AgenticRun): Promise<AgenticRun>;
  get(runId: string): Promise<AgenticRun | undefined>;
}

export interface AgenticUsageRepository {
  recordMessageUsage(messageId: string, usage: AgenticUsage): Promise<void>;
  recordRunUsage(runId: string, usage: AgenticUsage): Promise<void>;
}

export interface AgenticSummaryRepository {
  getLatest(
    conversationId: string,
  ): Promise<AgenticConversationSummary | undefined>;
  create(
    summary: AgenticConversationSummary,
  ): Promise<AgenticConversationSummary>;
}

export interface AgenticPromptListOptions {
  ownerParticipantId: string;
  search?: string;
  limit?: number;
}

export interface AgenticPromptRepository {
  create(prompt: AgenticPrompt): Promise<AgenticPrompt>;
  getForOwner(
    promptId: string,
    ownerParticipantId: string,
  ): Promise<AgenticPrompt | undefined>;
  listForOwner(options: AgenticPromptListOptions): Promise<AgenticPrompt[]>;
  updateForOwner(prompt: AgenticPrompt): Promise<AgenticPrompt>;
  deleteForOwner(promptId: string, ownerParticipantId: string): Promise<void>;
}

export interface AgenticRepositories {
  conversations?: AgenticConversationRepository;
  messages: AgenticMessageRepository;
  runs?: AgenticRunRepository;
  usage?: AgenticUsageRepository;
  summaries?: AgenticSummaryRepository;
  prompts?: AgenticPromptRepository;
}
