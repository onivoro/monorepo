import {
  AgenticConversation,
  AgenticConversationStatus,
  AgenticConversationSummary,
  AgenticMessage,
  AgenticMessageStatus,
  AgenticPrompt,
  AgenticRole,
  AgenticRun,
  AgenticRunStatus,
} from '@onivoro/isomorphic-agentic';
import { AgenticConversationSummaryRecord } from '../entities/agentic-conversation-summary.entity';
import { AgenticConversationRecord } from '../entities/agentic-conversation.entity';
import { AgenticMessageRecord } from '../entities/agentic-message.entity';
import { AgenticPromptRecord } from '../entities/agentic-prompt.entity';
import { AgenticRunRecord } from '../entities/agentic-run.entity';

export function toConversationRecord(
  conversation: AgenticConversation,
): AgenticConversationRecord {
  return {
    id: conversation.id,
    title: conversation.title,
    status: conversation.status,
    participantIds: conversation.participantIds,
    latestSummaryMessageId: conversation.latestSummaryMessageId,
    metadata: conversation.metadata,
    createdAt: toDate(conversation.createdAt),
    updatedAt: toDate(conversation.updatedAt),
  };
}

export function fromConversationRecord(
  record: AgenticConversationRecord,
): AgenticConversation {
  return {
    id: record.id,
    title: record.title,
    status: record.status as AgenticConversationStatus,
    participantIds: record.participantIds,
    latestSummaryMessageId: record.latestSummaryMessageId,
    metadata: record.metadata,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
  };
}

export function toMessageRecord(message: AgenticMessage): AgenticMessageRecord {
  return {
    id: message.id,
    conversationId: message.conversationId,
    role: message.role,
    status: message.status,
    parentMessageId: message.parentMessageId,
    runId: message.runId,
    model: message.model,
    provider: message.provider,
    parts: message.parts,
    usage: message.usage,
    compactedAt: message.compactedAt ? toDate(message.compactedAt) : undefined,
    metadata: message.metadata,
    createdAt: toDate(message.createdAt),
    updatedAt: toDate(message.updatedAt),
  };
}

export function fromMessageRecord(
  record: AgenticMessageRecord,
): AgenticMessage {
  return {
    id: record.id,
    conversationId: record.conversationId,
    role: record.role as AgenticRole,
    status: record.status as AgenticMessageStatus,
    parentMessageId: record.parentMessageId,
    runId: record.runId,
    model: record.model,
    provider: record.provider,
    parts: record.parts ?? [],
    usage: record.usage,
    compactedAt: record.compactedAt ? toIso(record.compactedAt) : undefined,
    metadata: record.metadata,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
  };
}

export function toRunRecord(run: AgenticRun): AgenticRunRecord {
  return {
    id: run.id,
    conversationId: run.conversationId,
    status: run.status,
    userMessageId: run.userMessageId,
    assistantMessageId: run.assistantMessageId,
    model: run.model,
    provider: run.provider,
    usage: run.usage,
    errorMessage: run.errorMessage,
    metadata: run.metadata,
    startedAt: toDate(run.startedAt),
    completedAt: run.completedAt ? toDate(run.completedAt) : undefined,
    updatedAt: toDate(run.updatedAt),
  };
}

export function fromRunRecord(record: AgenticRunRecord): AgenticRun {
  return {
    id: record.id,
    conversationId: record.conversationId,
    status: record.status as AgenticRunStatus,
    userMessageId: record.userMessageId,
    assistantMessageId: record.assistantMessageId,
    model: record.model,
    provider: record.provider,
    usage: record.usage,
    errorMessage: record.errorMessage,
    metadata: record.metadata,
    startedAt: toIso(record.startedAt),
    completedAt: record.completedAt ? toIso(record.completedAt) : undefined,
    updatedAt: toIso(record.updatedAt),
  };
}

export function toSummaryRecord(
  summary: AgenticConversationSummary,
): AgenticConversationSummaryRecord {
  return {
    id: summary.id,
    conversationId: summary.conversationId,
    summaryMessageId: summary.summaryMessageId,
    startMessageId: summary.startMessageId,
    endMessageId: summary.endMessageId,
    tokenCount: summary.tokenCount,
    createdAt: toDate(summary.createdAt),
    metadata: summary.metadata,
  };
}

export function fromSummaryRecord(
  record: AgenticConversationSummaryRecord,
): AgenticConversationSummary {
  return {
    id: record.id,
    conversationId: record.conversationId,
    summaryMessageId: record.summaryMessageId,
    startMessageId: record.startMessageId,
    endMessageId: record.endMessageId,
    tokenCount: record.tokenCount,
    createdAt: toIso(record.createdAt),
    metadata: record.metadata,
  };
}

export function toPromptRecord(prompt: AgenticPrompt): AgenticPromptRecord {
  return {
    id: prompt.id,
    ownerParticipantId: prompt.ownerParticipantId,
    title: prompt.title,
    prompt: prompt.prompt,
    parameters: prompt.parameters,
    metadata: prompt.metadata,
    createdAt: toDate(prompt.createdAt),
    updatedAt: toDate(prompt.updatedAt),
  };
}

export function fromPromptRecord(record: AgenticPromptRecord): AgenticPrompt {
  return {
    id: record.id,
    ownerParticipantId: record.ownerParticipantId,
    title: record.title,
    prompt: record.prompt,
    parameters: record.parameters ?? [],
    metadata: record.metadata,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
  };
}

export function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function toIso(value: string | Date): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}
