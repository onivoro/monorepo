import type {
  AgenticEvent,
  AgenticMessage,
  JsonObject,
} from '@onivoro/isomorphic-agentic';
import {
  createEmptyAgenticClientState,
  reduceAgenticEvent,
} from '@onivoro/isomorphic-agentic';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import type { AgenticChatClient } from './agentic-chat-client';

export interface UseAgenticChatResult {
  conversationId: string;
  error?: string;
  isConnected: boolean;
  isLoading: boolean;
  isSending: boolean;
  messages: AgenticMessage[];
  reload: () => Promise<void>;
  sendMessage: (text: string, metadata?: JsonObject) => Promise<void>;
}

export interface AgenticEventStream {
  /**
   * Whether events are currently arriving. Surfaced so a UI can distinguish a
   * quiet conversation from a broken connection.
   */
  isConnected: boolean;
}

/**
 * Delivers a conversation's events to the chat, as a hook the host supplies.
 *
 * This is the transport seam, and it is a hook rather than a callback because
 * every real implementation needs state of its own -- a socket from context, an
 * EventSource in a ref, a connection flag. Subscribe on mount, call `onEvent`
 * for each event, and tear down on unmount.
 *
 * Websockets, server-sent events and long-polling all satisfy it, and this
 * package deliberately knows about none of them.
 *
 * **Must be referentially stable.** It is called as a hook on every render, so
 * define it at module scope or memoize it -- swapping implementations between
 * renders breaks the rules of hooks.
 */
export type UseAgenticEventStream = (
  conversationId: string,
  onEvent: (event: AgenticEvent) => void,
) => AgenticEventStream;

/**
 * The default when no transport is configured: messages still load over HTTP
 * and sending still works, but nothing streams. Reported as disconnected,
 * because that is what it is.
 */
export const useNoAgenticEventStream: UseAgenticEventStream = () => ({
  isConnected: false,
});

export interface UseAgenticChatConfig {
  client: AgenticChatClient;
  useEventStream?: UseAgenticEventStream;
}

export function createUseAgenticChat(config: UseAgenticChatConfig) {
  return function useAgenticChat(conversationId: string): UseAgenticChatResult {
    return useConfiguredAgenticChat(conversationId, config);
  };
}

export function useConfiguredAgenticChat(
  conversationId: string,
  config: UseAgenticChatConfig,
): UseAgenticChatResult {
  const [state, dispatchEvent] = useReducer(
    reduceAgenticEvent,
    createEmptyAgenticClientState(),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string>();

  const useEventStream = config.useEventStream ?? useNoAgenticEventStream;
  const { isConnected } = useEventStream(conversationId, dispatchEvent);

  const messages = useMemo(
    () => state.messagesByConversationId[conversationId] ?? [],
    [conversationId, state.messagesByConversationId],
  );

  const loadMessages = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      setError(undefined);

      try {
        const loadedMessages =
          await config.client.listAgenticMessages(conversationId);

        if (signal?.aborted) return;

        for (const message of loadedMessages) {
          dispatchEvent({ type: 'message.upsert', conversationId, message });
        }
      } catch (caught) {
        if (!signal?.aborted) setError(errorMessage(caught));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [config.client, conversationId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadMessages(controller.signal);
    return () => controller.abort();
  }, [loadMessages]);

  const reload = useCallback(async () => {
    await loadMessages();
  }, [loadMessages]);

  const sendMessage = useCallback(
    async (text: string, metadata?: JsonObject) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      setIsSending(true);
      setError(undefined);

      try {
        await config.client.agenticFetch<unknown>(
          config.client.agenticMessagesUrl(conversationId),
          {
            method: 'POST',
            body: JSON.stringify({ metadata, text: trimmed }),
          },
        );
        await loadMessages();
      } catch (caught) {
        setError(errorMessage(caught));
      } finally {
        setIsSending(false);
      }
    },
    [config.client, conversationId, loadMessages],
  );

  return {
    conversationId,
    error,
    isConnected,
    isLoading,
    isSending,
    messages,
    reload,
    sendMessage,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
