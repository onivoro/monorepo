import { AgenticChatService } from './agentic-chat.service';
import { AgenticConversationLifecycleService } from './agentic-conversation-lifecycle.service';
import {
  createLifecycleAgenticConversation,
  deleteLifecycleAgenticConversation,
  getLifecycleAgenticConversation,
  listLifecycleAgenticConversations,
  listLifecycleAgenticMessages,
  sendLifecycleAgenticMessage,
  updateLifecycleAgenticConversation,
} from './agentic-conversation-service-helpers';

describe('agentic conversation service helpers', () => {
  const user = { participantId: 'user-1', metadata: { team: 'a' } };

  function setup(conversationMetadata = { resourceType: 'order' }) {
    const lifecycle = {
      ensureConversation: jest.fn(async () => ({
        id: 'c-1',
        metadata: conversationMetadata,
      })),
      touchConversation: jest.fn(async () => undefined),
      listConversations: jest.fn(async () => ['list']),
      createConversation: jest.fn(async () => 'created'),
      getConversation: jest.fn(async () => 'conversation'),
      updateConversation: jest.fn(async () => 'updated'),
      deleteConversation: jest.fn(async () => undefined),
      listMessages: jest.fn(async () => ['message']),
    };
    const agenticChat = {
      sendUserMessage: jest.fn(async () => ({ id: 'run-1' })),
    };
    return {
      agenticChat,
      lifecycle,
      typedLifecycle:
        lifecycle as unknown as AgenticConversationLifecycleService,
      typedChat: agenticChat as unknown as AgenticChatService,
    };
  }

  describe(sendLifecycleAgenticMessage.name, () => {
    it('ensures the conversation, sends the message and touches it', async () => {
      const { agenticChat, lifecycle, typedChat, typedLifecycle } = setup();
      const system = jest.fn(
        (metadata) => `system for ${metadata.resourceType}`,
      );

      const run = await sendLifecycleAgenticMessage({
        agenticChat: typedChat,
        lifecycle: typedLifecycle,
        authInfo: async () => ({ token: 'abc' }),
        conversationId: 'c-1',
        conversationMetadata: { source: 'web' },
        messageMetadata: { page: 'home' },
        system,
        text: '  Hello   there  ',
        user,
        userId: 'user-1',
      });

      expect(run).toEqual({ id: 'run-1' });
      expect(lifecycle.ensureConversation).toHaveBeenCalledWith({
        conversationId: 'c-1',
        metadata: { source: 'web' },
        title: 'Hello there',
        user,
      });
      expect(system).toHaveBeenCalledWith({
        resourceType: 'order',
        page: 'home',
      });
      expect(agenticChat.sendUserMessage).toHaveBeenCalledWith({
        conversationId: 'c-1',
        text: '  Hello   there  ',
        userId: 'user-1',
        sessionId: 'c-1',
        authInfo: { token: 'abc' },
        metadata: { resourceType: 'order', page: 'home' },
        system: 'system for order',
      });
      expect(lifecycle.touchConversation).toHaveBeenCalledWith('c-1');
      expect(
        lifecycle.touchConversation.mock.invocationCallOrder[0],
      ).toBeGreaterThan(
        agenticChat.sendUserMessage.mock.invocationCallOrder[0],
      );
    });

    it('accepts a static system prompt, plain auth info and an explicit session', async () => {
      const { agenticChat, typedChat, typedLifecycle } = setup();

      await sendLifecycleAgenticMessage({
        agenticChat: typedChat,
        lifecycle: typedLifecycle,
        authInfo: 'token',
        conversationId: 'c-1',
        sessionId: 'session-9',
        system: 'static',
        text: 'hi',
        user,
        userId: 'user-1',
      });

      expect(agenticChat.sendUserMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          authInfo: 'token',
          sessionId: 'session-9',
          system: 'static',
        }),
      );
    });

    it('does not touch the conversation when sending fails', async () => {
      const { agenticChat, lifecycle, typedChat, typedLifecycle } = setup();
      agenticChat.sendUserMessage.mockRejectedValueOnce(new Error('nope'));

      await expect(
        sendLifecycleAgenticMessage({
          agenticChat: typedChat,
          lifecycle: typedLifecycle,
          authInfo: undefined,
          conversationId: 'c-1',
          system: 's',
          text: 'hi',
          user,
          userId: 'user-1',
        }),
      ).rejects.toThrow('nope');
      expect(lifecycle.touchConversation).not.toHaveBeenCalled();
    });
  });

  it('delegates conversation listing with the participant id', async () => {
    const { lifecycle, typedLifecycle } = setup();

    await expect(
      listLifecycleAgenticConversations({
        lifecycle: typedLifecycle,
        user,
        limit: 3,
        resourceId: 'r',
        resourceType: 't',
        search: 's',
      }),
    ).resolves.toEqual(['list']);
    expect(lifecycle.listConversations).toHaveBeenCalledWith({
      limit: 3,
      participantId: 'user-1',
      resourceId: 'r',
      resourceType: 't',
      search: 's',
    });
  });

  it('delegates create, get, update, delete and message listing', async () => {
    const { lifecycle, typedLifecycle } = setup();

    await expect(
      createLifecycleAgenticConversation({
        lifecycle: typedLifecycle,
        id: 'c-1',
        metadata: { a: 1 },
        title: 'T',
        user,
      }),
    ).resolves.toBe('created');
    expect(lifecycle.createConversation).toHaveBeenCalledWith({
      id: 'c-1',
      metadata: { a: 1 },
      title: 'T',
      user,
    });

    await expect(
      getLifecycleAgenticConversation({
        lifecycle: typedLifecycle,
        conversationId: 'c-1',
        user,
      }),
    ).resolves.toBe('conversation');
    expect(lifecycle.getConversation).toHaveBeenCalledWith('c-1', user);

    await expect(
      updateLifecycleAgenticConversation({
        lifecycle: typedLifecycle,
        conversationId: 'c-1',
        status: 'archived',
        title: 'New',
        user,
      }),
    ).resolves.toBe('updated');
    expect(lifecycle.updateConversation).toHaveBeenCalledWith({
      conversationId: 'c-1',
      status: 'archived',
      title: 'New',
      user,
    });

    await deleteLifecycleAgenticConversation({
      lifecycle: typedLifecycle,
      conversationId: 'c-1',
      user,
    });
    expect(lifecycle.deleteConversation).toHaveBeenCalledWith({
      conversationId: 'c-1',
      user,
    });

    await expect(
      listLifecycleAgenticMessages({
        lifecycle: typedLifecycle,
        conversationId: 'c-1',
        user,
      }),
    ).resolves.toEqual(['message']);
    expect(lifecycle.listMessages).toHaveBeenCalledWith('c-1', user);
  });
});
