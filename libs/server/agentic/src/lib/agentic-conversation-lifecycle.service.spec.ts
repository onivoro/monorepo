import {
  AgenticConversation,
  AgenticConversationListOptions,
  AgenticMessage,
} from '@onivoro/isomorphic-agentic';
import { NotFoundException } from '@nestjs/common';
import { AgenticConversationLifecycleService } from './agentic-conversation-lifecycle.service';

describe(AgenticConversationLifecycleService.name, () => {
  it('soft deletes conversations and hides them from later access', async () => {
    const conversations = new InMemoryConversationRepository();
    const service = new AgenticConversationLifecycleService({
      conversations,
      messages: new EmptyMessageRepository(),
    });
    const conversation = await service.createConversation({
      title: 'Delete me',
      user: { participantId: 'user@example.com' },
    });

    await service.deleteConversation({
      conversationId: conversation.id,
      user: { participantId: 'user@example.com' },
    });

    await expect(
      service.getConversation(conversation.id, {
        participantId: 'user@example.com',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.listConversations({ participantId: 'user@example.com' }),
    ).resolves.toEqual([]);
    await expect(conversations.get(conversation.id)).resolves.toMatchObject({
      status: 'deleted',
    });
  });
});

class InMemoryConversationRepository {
  private readonly conversations = new Map<string, AgenticConversation>();

  async create(
    conversation: AgenticConversation,
  ): Promise<AgenticConversation> {
    this.conversations.set(conversation.id, conversation);
    return conversation;
  }

  async get(conversationId: string): Promise<AgenticConversation | undefined> {
    return this.conversations.get(conversationId);
  }

  async update(
    conversation: AgenticConversation,
  ): Promise<AgenticConversation> {
    this.conversations.set(conversation.id, conversation);
    return conversation;
  }

  async list(
    options: AgenticConversationListOptions = {},
  ): Promise<AgenticConversation[]> {
    return Array.from(this.conversations.values()).filter((conversation) => {
      if (conversation.status !== (options.status ?? 'active')) return false;
      if (
        options.participantId &&
        !conversation.participantIds?.includes(options.participantId)
      ) {
        return false;
      }
      return true;
    });
  }
}

class EmptyMessageRepository {
  async create(message: AgenticMessage): Promise<AgenticMessage> {
    return message;
  }

  async update(message: AgenticMessage): Promise<AgenticMessage> {
    return message;
  }

  async get(): Promise<AgenticMessage | undefined> {
    return undefined;
  }

  async listByConversationId(): Promise<AgenticMessage[]> {
    return [];
  }

  async listNewestByConversationId(): Promise<AgenticMessage[]> {
    return [];
  }

  async countByConversationId(): Promise<number> {
    return 0;
  }

  async upsertPart(): Promise<void> {}

  async appendPartDelta(): Promise<void> {}
}
