import { act, renderHook, waitFor } from '@testing-library/react';
import type { AgenticEvent, AgenticMessage } from '@onivoro/isomorphic-agentic';
import type { AgenticChatClient } from './agentic-chat-client';
import {
  useConfiguredAgenticChat,
  useNoAgenticEventStream,
  type UseAgenticEventStream,
} from './use-agentic-chat';

const now = '2026-01-01T00:00:00.000Z';

const message = (id: string, text: string): AgenticMessage => ({
  id,
  conversationId: 'c1',
  role: 'assistant',
  status: 'complete',
  parts: [
    {
      id: `${id}-p`,
      type: 'text',
      text,
      status: 'complete',
      createdAt: now,
      updatedAt: now,
    },
  ],
  createdAt: now,
  updatedAt: now,
});

function fakeClient(overrides: Partial<AgenticChatClient> = {}) {
  return {
    listAgenticMessages: jest.fn().mockResolvedValue([]),
    agenticFetch: jest.fn().mockResolvedValue(undefined),
    agenticMessagesUrl: (id: string) => `/api/agentic-chat/${id}/messages`,
    ...overrides,
  } as unknown as AgenticChatClient;
}

describe('useConfiguredAgenticChat', () => {
  it('loads existing messages on mount', async () => {
    const client = fakeClient({
      listAgenticMessages: jest.fn().mockResolvedValue([message('m1', 'hi')]),
    });

    const { result } = renderHook(() =>
      useConfiguredAgenticChat('c1', { client }),
    );

    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.isLoading).toBe(false);
  });

  it('surfaces a load failure without throwing', async () => {
    const client = fakeClient({
      listAgenticMessages: jest.fn().mockRejectedValue(new Error('nope')),
    });

    const { result } = renderHook(() =>
      useConfiguredAgenticChat('c1', { client }),
    );

    await waitFor(() => expect(result.current.error).toBe('nope'));
  });

  // without a transport the chat still works over HTTP; it just does not stream
  it('reports disconnected when no event stream is configured', async () => {
    const { result } = renderHook(() =>
      useConfiguredAgenticChat('c1', { client: fakeClient() }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isConnected).toBe(false);
  });

  it('applies events delivered by the configured stream', async () => {
    let emit: ((event: AgenticEvent) => void) | undefined;
    const useEventStream: UseAgenticEventStream = (
      _conversationId,
      onEvent,
    ) => {
      emit = onEvent;
      return { isConnected: true };
    };

    const { result } = renderHook(() =>
      useConfiguredAgenticChat('c1', { client: fakeClient(), useEventStream }),
    );

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    act(() => {
      emit?.({
        type: 'message.upsert',
        conversationId: 'c1',
        message: message('m9', 'streamed'),
      });
    });

    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.messages[0].id).toBe('m9');
  });

  it('passes the conversation id to the stream', async () => {
    const seen: string[] = [];
    const useEventStream: UseAgenticEventStream = (conversationId) => {
      seen.push(conversationId);
      return { isConnected: true };
    };

    renderHook(() =>
      useConfiguredAgenticChat('c-42', {
        client: fakeClient(),
        useEventStream,
      }),
    );

    await waitFor(() => expect(seen).toContain('c-42'));
  });

  it('only shows events for the conversation being viewed', async () => {
    let emit: ((event: AgenticEvent) => void) | undefined;
    const useEventStream: UseAgenticEventStream = (_id, onEvent) => {
      emit = onEvent;
      return { isConnected: true };
    };

    const { result } = renderHook(() =>
      useConfiguredAgenticChat('c1', { client: fakeClient(), useEventStream }),
    );

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    act(() => {
      emit?.({
        type: 'message.upsert',
        conversationId: 'other',
        message: { ...message('m9', 'elsewhere'), conversationId: 'other' },
      });
    });

    expect(result.current.messages).toHaveLength(0);
  });

  it('posts a trimmed message and reloads', async () => {
    const client = fakeClient();
    const { result } = renderHook(() =>
      useConfiguredAgenticChat('c1', { client }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.sendMessage('  hello  ');
    });

    expect(client.agenticFetch).toHaveBeenCalledWith(
      '/api/agentic-chat/c1/messages',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ metadata: undefined, text: 'hello' }),
      }),
    );
    expect(client.listAgenticMessages).toHaveBeenCalledTimes(2);
  });

  it('ignores an empty message rather than posting it', async () => {
    const client = fakeClient();
    const { result } = renderHook(() =>
      useConfiguredAgenticChat('c1', { client }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.sendMessage('   ');
    });

    expect(client.agenticFetch).not.toHaveBeenCalled();
  });

  it('surfaces a send failure and stops sending', async () => {
    const client = fakeClient({
      agenticFetch: jest.fn().mockRejectedValue(new Error('rejected')),
    });
    const { result } = renderHook(() =>
      useConfiguredAgenticChat('c1', { client }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.sendMessage('hello');
    });

    expect(result.current.error).toBe('rejected');
    expect(result.current.isSending).toBe(false);
  });
});

describe('useNoAgenticEventStream', () => {
  it('is always disconnected', () => {
    expect(useNoAgenticEventStream('c1', () => undefined)).toEqual({
      isConnected: false,
    });
  });
});
