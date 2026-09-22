import type {
  AgenticConversation,
  AgenticConversationListItem,
  JsonObject,
} from '@onivoro/isomorphic-agentic';
import {
  AgenticChatClient,
  createAgenticChatClient,
  ListAgenticConversationsOptions,
} from './agentic-chat-client';
import type {
  AgenticChatClientConfig,
  AgenticPromptLibraryClient,
} from './agentic-chat.types';
import {
  createUseAgenticChat,
  type UseAgenticEventStream,
} from './use-agentic-chat';

export interface BrowserAgenticChatAdapterConfig {
  apiBaseUrl: AgenticChatClientConfig['apiBaseUrl'];
  credentials?: RequestCredentials;
  getAuthorizationHeader?: () => string | undefined;
  getMcpAuthorizationHeader?: () => string | undefined;
  mcpAuthorizationHeaderName: string;

  /**
   * How this application receives a conversation's events -- websocket, SSE,
   * anything. Omit it and the chat still loads and sends over HTTP, but nothing
   * streams. Must be referentially stable; see `UseAgenticEventStream`.
   */
  useEventStream?: UseAgenticEventStream;
}

export interface BrowserAgenticChatAdapter {
  agenticClient: AgenticChatClient;
  agenticFetch: AgenticChatClient['agenticFetch'];
  agenticMessagesUrl: AgenticChatClient['agenticMessagesUrl'];
  createAgenticConversation: (input?: {
    id?: string;
    title?: string;
    metadata?: JsonObject;
  }) => Promise<AgenticConversation>;
  createAgenticPrompt: AgenticChatClient['createAgenticPrompt'];
  deleteAgenticConversation: (conversationId: string) => Promise<void>;
  deleteAgenticPrompt: AgenticChatClient['deleteAgenticPrompt'];
  ensureAgenticConversation: (input: {
    id: string;
    title?: string;
    metadata?: JsonObject;
  }) => Promise<AgenticConversation>;
  getAgenticConversation: (
    conversationId: string,
  ) => Promise<AgenticConversation>;
  listAgenticConversations: (
    options?: ListAgenticConversationsOptions,
  ) => Promise<AgenticConversationListItem[]>;
  listAgenticPrompts: AgenticChatClient['listAgenticPrompts'];
  promptLibrary: AgenticPromptLibraryClient;
  renderAgenticPrompt: AgenticChatClient['renderAgenticPrompt'];
  updateAgenticPrompt: AgenticChatClient['updateAgenticPrompt'];
  useAgenticChat: ReturnType<typeof createUseAgenticChat>;
}

export function createBrowserAgenticChatAdapter(
  config: BrowserAgenticChatAdapterConfig,
): BrowserAgenticChatAdapter {
  const agenticClient = createAgenticChatClient({
    apiBaseUrl: config.apiBaseUrl,
    credentials: config.credentials,
    authHeaders: () =>
      headersFromAuthorization(config.getAuthorizationHeader?.()),
    extraSendHeaders: () => {
      const headers = new Headers();
      const mcpAuthorization = config.getMcpAuthorizationHeader?.();
      if (mcpAuthorization) {
        headers.set(config.mcpAuthorizationHeaderName, mcpAuthorization);
      }
      return headers;
    },
  });

  return {
    agenticClient,
    agenticFetch: agenticClient.agenticFetch,
    agenticMessagesUrl: agenticClient.agenticMessagesUrl,
    createAgenticConversation: (input = {}) =>
      agenticClient.createAgenticConversation(input),
    createAgenticPrompt: agenticClient.createAgenticPrompt,
    deleteAgenticConversation: agenticClient.deleteAgenticConversation,
    deleteAgenticPrompt: agenticClient.deleteAgenticPrompt,
    ensureAgenticConversation: agenticClient.ensureAgenticConversation,
    getAgenticConversation: agenticClient.getAgenticConversation,
    listAgenticConversations: (options = {}) =>
      agenticClient.listAgenticConversations(options),
    listAgenticPrompts: agenticClient.listAgenticPrompts,
    promptLibrary: {
      createPrompt: agenticClient.createAgenticPrompt,
      deletePrompt: agenticClient.deleteAgenticPrompt,
      listPrompts: agenticClient.listAgenticPrompts,
      updatePrompt: agenticClient.updateAgenticPrompt,
    },
    renderAgenticPrompt: agenticClient.renderAgenticPrompt,
    updateAgenticPrompt: agenticClient.updateAgenticPrompt,
    useAgenticChat: createUseAgenticChat({
      client: agenticClient,
      useEventStream: config.useEventStream,
    }),
  };
}

function headersFromAuthorization(authorization: string | undefined): Headers {
  const headers = new Headers();
  if (authorization) headers.set('Authorization', authorization);
  return headers;
}
