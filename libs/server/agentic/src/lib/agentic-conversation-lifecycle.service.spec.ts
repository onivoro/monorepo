import {
  AgenticConversation,
  AgenticConversationListOptions,
  AgenticMessage,
} from '@onivoro/isomorphic-agentic';
import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  AgenticConversationLifecycleService,
  titleFromPrompt,
} from './agentic-conversation-lifecycle.service';

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

describe(`${AgenticConversationLifecycleService.name} behaviour`, () => {
  const user = { participantId: 'user-1' };

  function setup(seed: AgenticConversation[] = []) {
    const conversations = new InMemoryConversationRepository();
    for (const conversation of seed) void conversations.create(conversation);
    const messages = new EmptyMessageRepository();
    const service = new AgenticConversationLifecycleService({
      conversations,
      messages,
    });
    return { conversations, messages, service };
  }

  function conversation(
    overrides: Partial<AgenticConversation> = {},
  ): AgenticConversation {
    return {
      id: 'c-1',
      status: 'active',
      participantIds: ['user-1'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    };
  }

  describe('listConversations', () => {
    it('drops the participant filter when filtering by resource', async () => {
      const { conversations, service } = setup();
      const list = jest.spyOn(conversations, 'list');

      await service.listConversations({
        participantId: 'user-1',
        resourceId: 'r-1',
        resourceType: 'order',
        search: 'q',
        limit: 5,
      });
      await service.listConversations({
        participantId: 'user-1',
        resourceId: 'r-1',
      });

      expect(list).toHaveBeenNthCalledWith(1, {
        limit: 5,
        participantId: undefined,
        resourceId: 'r-1',
        resourceType: 'order',
        search: 'q',
        status: 'active',
      });
      expect(list).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ participantId: 'user-1' }),
      );
    });

    it('returns an empty list when the repository cannot list', async () => {
      const service = new AgenticConversationLifecycleService({
        conversations: {
          create: jest.fn(),
          get: jest.fn(),
          update: jest.fn(),
        },
        messages: new EmptyMessageRepository(),
      });

      await expect(
        service.listConversations({ participantId: 'user-1' }),
      ).resolves.toEqual([]);
    });

    it('decorates conversations with preview, count and last message time', async () => {
      const { messages, service } = setup([conversation()]);
      jest.spyOn(messages, 'countByConversationId').mockResolvedValue(7);
      const listNewest = jest
        .spyOn(messages, 'listNewestByConversationId')
        .mockResolvedValue([
          msg('tool', [
            {
              id: 't',
              type: 'tool-result',
              toolCallId: 'x',
              name: 'x',
              result: 'r',
            },
          ]),
          msg('assistant', [
            { id: 'a', type: 'tool-call', toolCallId: 'x', name: 'x' },
            { id: 'b', type: 'text', text: '   ' },
            { id: 'c', type: 'reasoning', text: `  ${'z'.repeat(200)} ` },
          ]),
        ]);

      const [item] = await service.listConversations({
        participantId: 'user-1',
      });

      expect(listNewest).toHaveBeenCalledWith('c-1', {
        includeCompacted: false,
        limit: 12,
      });
      expect(item).toMatchObject({
        id: 'c-1',
        messageCount: 7,
        lastMessageAt: '2026-02-01T00:00:00.000Z',
        preview: 'z'.repeat(180),
      });
    });

    it('uses summary text and leaves preview empty without user or assistant text', async () => {
      const { messages, service } = setup();
      jest
        .spyOn(messages, 'listNewestByConversationId')
        .mockResolvedValueOnce([
          msg('user', [{ id: 's', type: 'summary', text: 'summary text' }]),
        ])
        .mockResolvedValueOnce([
          msg('user', [
            { id: 'i', type: 'tool-call', toolCallId: 'y', name: 'y' },
          ]),
        ])
        .mockResolvedValueOnce([]);

      await expect(
        service.toConversationListItem(conversation()),
      ).resolves.toMatchObject({ preview: 'summary text' });
      await expect(
        service.toConversationListItem(conversation()),
      ).resolves.toMatchObject({ preview: '' });
      await expect(
        service.toConversationListItem(conversation()),
      ).resolves.toMatchObject({
        preview: undefined,
        lastMessageAt: undefined,
      });
    });
  });

  describe('createConversation', () => {
    it('trims the title and merges user metadata over input metadata', async () => {
      const { service } = setup();

      const created = await service.createConversation({
        id: 'new',
        title: '  Hello  ',
        metadata: { a: 1, shared: 'input' },
        user: { participantId: 'user-1', metadata: { shared: 'user' } },
      });

      expect(created).toMatchObject({
        id: 'new',
        status: 'active',
        title: 'Hello',
        participantIds: ['user-1'],
        metadata: { a: 1, shared: 'user' },
      });
    });

    it('drops blank titles and generates an id when none is given', async () => {
      const { service } = setup();

      const created = await service.createConversation({ title: '   ', user });

      expect(created.title).toBeUndefined();
      expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('rejects ids that already exist', async () => {
      const { service } = setup([conversation()]);

      await expect(
        service.createConversation({ id: 'c-1', user }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('ensureConversation', () => {
    it('creates a missing conversation', async () => {
      const { service } = setup();

      await expect(
        service.ensureConversation({
          conversationId: 'c-9',
          title: 'T',
          metadata: { m: 1 },
          user: { participantId: 'user-1', metadata: { u: 2 } },
        }),
      ).resolves.toMatchObject({
        id: 'c-9',
        title: 'T',
        metadata: { m: 1, u: 2 },
      });
    });

    it('returns an existing conversation untouched when nothing changes', async () => {
      const existing = conversation({ title: 'Existing' });
      const { conversations, service } = setup([existing]);
      const update = jest.spyOn(conversations, 'update');

      await expect(
        service.ensureConversation({
          conversationId: 'c-1',
          title: 'Ignored',
          user,
        }),
      ).resolves.toBe(existing);
      expect(update).not.toHaveBeenCalled();
    });

    it('fills a missing title and merges metadata on an existing conversation', async () => {
      const { service } = setup([conversation({ metadata: { a: 1 } })]);

      await expect(
        service.ensureConversation({
          conversationId: 'c-1',
          title: 'New title',
          metadata: { b: 2 },
          user,
        }),
      ).resolves.toMatchObject({
        title: 'New title',
        metadata: { a: 1, b: 2 },
      });
    });

    it('keeps the existing title when only metadata changes', async () => {
      const { service } = setup([conversation({ title: 'Keep' })]);

      await expect(
        service.ensureConversation({
          conversationId: 'c-1',
          title: 'Other',
          metadata: { b: 2 },
          user,
        }),
      ).resolves.toMatchObject({ title: 'Keep', metadata: { b: 2 } });
    });

    it('hides conversations the user does not participate in', async () => {
      const { service } = setup([conversation({ participantIds: ['other'] })]);

      await expect(
        service.ensureConversation({ conversationId: 'c-1', user }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('access rules', () => {
    it('lets any user read resource conversations but only participants update them', async () => {
      const { service } = setup([
        conversation({
          participantIds: ['owner'],
          metadata: { resourceType: 'order', resourceId: 42 },
        }),
      ]);

      await expect(service.getConversation('c-1', user)).resolves.toMatchObject(
        { id: 'c-1' },
      );
      await expect(
        service.updateConversation({ conversationId: 'c-1', user, title: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('does not treat conversations with incomplete resource metadata as shared', async () => {
      const { service } = setup([
        conversation({
          participantIds: undefined,
          metadata: { resourceType: 'order', resourceId: true },
        }),
      ]);

      await expect(service.getConversation('c-1', user)).rejects.toThrow(
        'iGENTiC conversation "c-1" was not found.',
      );
    });

    it('rejects unknown conversations', async () => {
      const { service } = setup();

      await expect(service.getConversation('nope', user)).rejects.toThrow(
        'iGENTiC conversation "nope" was not found.',
      );
    });
  });

  describe('updateConversation', () => {
    it('updates status and trimmed title', async () => {
      const { service } = setup([conversation({ title: 'Old' })]);

      await expect(
        service.updateConversation({
          conversationId: 'c-1',
          status: 'archived',
          title: ' New ',
          user,
        }),
      ).resolves.toMatchObject({ status: 'archived', title: 'New' });
    });

    it('keeps status and title when not provided or blank', async () => {
      const { service } = setup([conversation({ title: 'Old' })]);

      await expect(
        service.updateConversation({ conversationId: 'c-1', title: ' ', user }),
      ).resolves.toMatchObject({ status: 'active', title: 'Old' });
    });
  });

  it('lists messages after checking access', async () => {
    const { messages, service } = setup([conversation()]);
    const listed = [msg('user', [{ id: 'p', type: 'text', text: 'hi' }])];
    jest.spyOn(messages, 'listByConversationId').mockResolvedValue(listed);

    await expect(service.listMessages('c-1', user)).resolves.toBe(listed);
    await expect(
      service.listMessages('c-1', { participantId: 'stranger' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('touchConversation', () => {
    it('bumps updatedAt on existing conversations', async () => {
      const { conversations, service } = setup([conversation()]);

      await service.touchConversation('c-1');

      expect((await conversations.get('c-1'))?.updatedAt).not.toBe(
        '2026-01-01T00:00:00.000Z',
      );
    });

    it('ignores missing conversations', async () => {
      const { conversations, service } = setup();
      const update = jest.spyOn(conversations, 'update');

      await service.touchConversation('missing');

      expect(update).not.toHaveBeenCalled();
    });
  });

  describe(titleFromPrompt.name, () => {
    it('collapses whitespace and truncates to 72 characters', () => {
      expect(titleFromPrompt('  hello \n\t world  ')).toBe('hello world');
      expect(titleFromPrompt('a'.repeat(100))).toHaveLength(72);
    });

    it('returns undefined for blank prompts', () => {
      expect(titleFromPrompt('   ')).toBeUndefined();
    });
  });
});

function msg(
  role: AgenticMessage['role'],
  parts: AgenticMessage['parts'],
): AgenticMessage {
  return {
    id: `m-${role}`,
    conversationId: 'c-1',
    role,
    status: 'complete',
    parts,
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
  };
}
