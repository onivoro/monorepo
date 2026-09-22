import {
  AgenticConversation,
  AgenticConversationListItem,
  AgenticConversationStatus,
  AgenticMessage,
  AgenticRun,
  JsonObject,
} from '@onivoro/isomorphic-agentic';
import { AgenticChatService } from './agentic-chat.service';
import {
  AgenticConversationLifecycleService,
  titleFromPrompt,
} from './agentic-conversation-lifecycle.service';

export interface AgenticParticipantContext {
  metadata?: JsonObject;
  participantId: string;
}

type AgenticAuthInfoResolver<TAuthInfo> =
  | TAuthInfo
  | (() => Promise<TAuthInfo> | TAuthInfo);

export interface SendLifecycleAgenticMessageInput<TAuthInfo> {
  agenticChat: AgenticChatService;
  authInfo: AgenticAuthInfoResolver<TAuthInfo>;
  conversationMetadata?: JsonObject;
  conversationId: string;
  lifecycle: AgenticConversationLifecycleService;
  messageMetadata?: JsonObject;
  sessionId?: string;
  system: string | ((metadata: JsonObject) => string);
  text: string;
  user: AgenticParticipantContext;
  userId: string;
}

export async function sendLifecycleAgenticMessage<TAuthInfo>(
  input: SendLifecycleAgenticMessageInput<TAuthInfo>,
): Promise<AgenticRun> {
  const conversation = await input.lifecycle.ensureConversation({
    conversationId: input.conversationId,
    metadata: input.conversationMetadata,
    title: titleFromPrompt(input.text),
    user: input.user,
  });
  const metadata: JsonObject = {
    ...conversation.metadata,
    ...input.messageMetadata,
  };
  const authInfo = await resolveAgenticAuthInfo(input.authInfo);
  const system =
    typeof input.system === 'function' ? input.system(metadata) : input.system;

  const run = await input.agenticChat.sendUserMessage({
    conversationId: input.conversationId,
    text: input.text,
    userId: input.userId,
    sessionId: input.sessionId ?? input.conversationId,
    authInfo,
    metadata,
    system,
  });

  await input.lifecycle.touchConversation(input.conversationId);
  return run;
}

async function resolveAgenticAuthInfo<TAuthInfo>(
  authInfo: AgenticAuthInfoResolver<TAuthInfo>,
): Promise<TAuthInfo> {
  return typeof authInfo === 'function'
    ? (authInfo as () => Promise<TAuthInfo> | TAuthInfo)()
    : authInfo;
}

export function listLifecycleAgenticConversations(input: {
  lifecycle: AgenticConversationLifecycleService;
  limit?: number;
  resourceId?: string;
  resourceType?: string;
  search?: string;
  user: AgenticParticipantContext;
}): Promise<AgenticConversationListItem[]> {
  return input.lifecycle.listConversations({
    limit: input.limit,
    participantId: input.user.participantId,
    resourceId: input.resourceId,
    resourceType: input.resourceType,
    search: input.search,
  });
}

export function createLifecycleAgenticConversation(input: {
  id?: string;
  lifecycle: AgenticConversationLifecycleService;
  metadata?: JsonObject;
  title?: string;
  user: AgenticParticipantContext;
}): Promise<AgenticConversation> {
  return input.lifecycle.createConversation({
    id: input.id,
    metadata: input.metadata,
    title: input.title,
    user: input.user,
  });
}

export function getLifecycleAgenticConversation(input: {
  conversationId: string;
  lifecycle: AgenticConversationLifecycleService;
  user: AgenticParticipantContext;
}): Promise<AgenticConversation> {
  return input.lifecycle.getConversation(input.conversationId, input.user);
}

export function updateLifecycleAgenticConversation(input: {
  conversationId: string;
  lifecycle: AgenticConversationLifecycleService;
  status?: AgenticConversationStatus;
  title?: string;
  user: AgenticParticipantContext;
}): Promise<AgenticConversation> {
  return input.lifecycle.updateConversation({
    conversationId: input.conversationId,
    status: input.status,
    title: input.title,
    user: input.user,
  });
}

export function deleteLifecycleAgenticConversation(input: {
  conversationId: string;
  lifecycle: AgenticConversationLifecycleService;
  user: AgenticParticipantContext;
}): Promise<void> {
  return input.lifecycle.deleteConversation({
    conversationId: input.conversationId,
    user: input.user,
  });
}

export function listLifecycleAgenticMessages(input: {
  conversationId: string;
  lifecycle: AgenticConversationLifecycleService;
  user: AgenticParticipantContext;
}): Promise<AgenticMessage[]> {
  return input.lifecycle.listMessages(input.conversationId, input.user);
}
