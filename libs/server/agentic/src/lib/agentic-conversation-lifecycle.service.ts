import { randomUUID } from 'node:crypto';
import {
  AgenticConversation,
  AgenticConversationListItem,
  AgenticConversationStatus,
  AgenticMessage,
  AgenticRepositories,
  JsonObject,
} from '@onivoro/isomorphic-agentic';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

export interface AgenticLifecycleMessageRepository {
  countByConversationId(
    conversationId: string,
    options?: { includeCompacted?: boolean },
  ): Promise<number>;
  listByConversationId(
    conversationId: string,
    options?: { includeCompacted?: boolean },
  ): Promise<AgenticMessage[]>;
  listNewestByConversationId(
    conversationId: string,
    options?: { includeCompacted?: boolean; limit?: number },
  ): Promise<AgenticMessage[]>;
}

export interface AgenticConversationLifecycleRepositories
  extends AgenticRepositories {
  conversations: NonNullable<AgenticRepositories['conversations']>;
  messages: AgenticRepositories['messages'] & AgenticLifecycleMessageRepository;
}

export interface AgenticConversationUserContext {
  participantId: string;
  metadata?: JsonObject;
}

export interface ListAgenticConversationsInput {
  limit?: number;
  participantId: string;
  resourceId?: string;
  resourceType?: string;
  search?: string;
}

export interface CreateAgenticConversationInput {
  id?: string;
  metadata?: JsonObject;
  title?: string;
  user: AgenticConversationUserContext;
}

export interface EnsureAgenticConversationInput {
  conversationId: string;
  metadata?: JsonObject;
  title?: string;
  user: AgenticConversationUserContext;
}

export interface UpdateAgenticConversationInput {
  conversationId: string;
  status?: AgenticConversationStatus;
  title?: string;
  user: Pick<AgenticConversationUserContext, 'participantId'>;
}

export interface DeleteAgenticConversationInput {
  conversationId: string;
  user: Pick<AgenticConversationUserContext, 'participantId'>;
}

@Injectable()
export class AgenticConversationLifecycleService {
  constructor(
    private readonly repositories: AgenticConversationLifecycleRepositories,
  ) {}

  async listConversations(
    input: ListAgenticConversationsInput,
  ): Promise<AgenticConversationListItem[]> {
    const conversations = await this.repositories.conversations.list?.({
      limit: input.limit,
      participantId: hasResourceFilter(input) ? undefined : input.participantId,
      resourceId: input.resourceId,
      resourceType: input.resourceType,
      search: input.search,
      status: 'active',
    });

    return Promise.all(
      (conversations ?? []).map((conversation) =>
        this.toConversationListItem(conversation),
      ),
    );
  }

  async createConversation(
    input: CreateAgenticConversationInput,
  ): Promise<AgenticConversation> {
    const now = new Date().toISOString();
    const id = input.id ?? randomUUID();
    const existing = await this.repositories.conversations.get(id);
    if (existing) {
      throw new ConflictException(
        `iGENTiC conversation "${id}" already exists.`,
      );
    }

    return this.repositories.conversations.create({
      id,
      status: 'active',
      participantIds: [input.user.participantId],
      title: input.title?.trim() || undefined,
      metadata: {
        ...input.metadata,
        ...input.user.metadata,
      },
      createdAt: now,
      updatedAt: now,
    });
  }

  async ensureConversation(
    input: EnsureAgenticConversationInput,
  ): Promise<AgenticConversation> {
    const existing = await this.repositories.conversations.get(
      input.conversationId,
    );
    if (existing) {
      assertUserCanAccessConversation(
        existing,
        input.user,
        input.conversationId,
      );
      const shouldUpdateTitle = !existing.title && input.title;
      const shouldUpdateMetadata = !!input.metadata;
      if (!shouldUpdateTitle && !shouldUpdateMetadata) return existing;

      return this.repositories.conversations.update({
        ...existing,
        metadata: { ...existing.metadata, ...input.metadata },
        title: shouldUpdateTitle ? input.title : existing.title,
        updatedAt: new Date().toISOString(),
      });
    }

    const now = new Date().toISOString();
    return this.repositories.conversations.create({
      id: input.conversationId,
      title: input.title,
      status: 'active',
      participantIds: [input.user.participantId],
      metadata: {
        ...input.metadata,
        ...input.user.metadata,
      },
      createdAt: now,
      updatedAt: now,
    });
  }

  async getConversation(
    conversationId: string,
    user: Pick<AgenticConversationUserContext, 'participantId'>,
  ): Promise<AgenticConversation> {
    const conversation =
      await this.repositories.conversations.get(conversationId);
    assertUserCanAccessConversation(conversation, user, conversationId);
    return conversation;
  }

  async updateConversation(
    input: UpdateAgenticConversationInput,
  ): Promise<AgenticConversation> {
    const conversation = await this.getConversation(
      input.conversationId,
      input.user,
    );
    assertUserParticipatesInConversation(conversation, input.user);

    return this.repositories.conversations.update({
      ...conversation,
      status: input.status ?? conversation.status,
      title: input.title?.trim() || conversation.title,
      updatedAt: new Date().toISOString(),
    });
  }

  async deleteConversation(
    input: DeleteAgenticConversationInput,
  ): Promise<void> {
    await this.updateConversation({
      conversationId: input.conversationId,
      status: 'deleted',
      user: input.user,
    });
  }

  async listMessages(
    conversationId: string,
    user: Pick<AgenticConversationUserContext, 'participantId'>,
  ): Promise<AgenticMessage[]> {
    await this.getConversation(conversationId, user);
    return this.repositories.messages.listByConversationId(conversationId);
  }

  async touchConversation(conversationId: string): Promise<void> {
    const conversation =
      await this.repositories.conversations.get(conversationId);
    if (!conversation) return;

    await this.repositories.conversations.update({
      ...conversation,
      updatedAt: new Date().toISOString(),
    });
  }

  async toConversationListItem(
    conversation: AgenticConversation,
  ): Promise<AgenticConversationListItem> {
    const [newestMessages, messageCount] = await Promise.all([
      this.repositories.messages.listNewestByConversationId(conversation.id, {
        includeCompacted: false,
        limit: 12,
      }),
      this.repositories.messages.countByConversationId(conversation.id, {
        includeCompacted: false,
      }),
    ]);
    const previewMessage = newestMessages.find(
      (message) => message.role === 'user' || message.role === 'assistant',
    );
    const preview = previewMessage
      ? firstText(previewMessage.parts).slice(0, 180)
      : undefined;
    const lastMessageAt = newestMessages[0]?.createdAt;

    return {
      ...conversation,
      lastMessageAt,
      messageCount,
      preview,
    };
  }
}

export function titleFromPrompt(prompt: string): string | undefined {
  const title = prompt.trim().replace(/\s+/g, ' ').slice(0, 72);
  return title || undefined;
}

function firstText(parts: AgenticMessage['parts']): string {
  for (const part of parts) {
    if (
      (part.type === 'text' ||
        part.type === 'summary' ||
        part.type === 'reasoning') &&
      part.text.trim()
    ) {
      return part.text.trim();
    }
  }

  return '';
}

function assertUserCanAccessConversation(
  conversation: AgenticConversation | undefined,
  user: Pick<AgenticConversationUserContext, 'participantId'>,
  conversationId = conversation?.id,
): asserts conversation is AgenticConversation {
  if (
    !conversation ||
    (!isResourceConversation(conversation) &&
      !conversation.participantIds?.includes(user.participantId)) ||
    conversation.status === 'deleted'
  ) {
    throw new NotFoundException(
      `iGENTiC conversation "${conversationId}" was not found.`,
    );
  }
}

function assertUserParticipatesInConversation(
  conversation: AgenticConversation,
  user: Pick<AgenticConversationUserContext, 'participantId'>,
): void {
  if (!conversation.participantIds?.includes(user.participantId)) {
    throw new NotFoundException(
      `iGENTiC conversation "${conversation.id}" was not found.`,
    );
  }
}

function hasResourceFilter(
  input: Pick<ListAgenticConversationsInput, 'resourceId' | 'resourceType'>,
): boolean {
  return !!input.resourceId && !!input.resourceType;
}

function isResourceConversation(conversation: AgenticConversation): boolean {
  const resourceId = conversation.metadata?.resourceId;

  return (
    typeof conversation.metadata?.resourceType === 'string' &&
    (typeof resourceId === 'string' || typeof resourceId === 'number')
  );
}
