import type {
  AgenticConversation,
  AgenticConversationListItem,
  AgenticMessage,
  AgenticPrompt,
  AgenticPromptCreateInput,
  AgenticPromptUpdateInput,
  JsonObject,
} from '@onivoro/isomorphic-agentic';
import type { AgenticChatClientConfig } from './agentic-chat.types';

export interface ListAgenticConversationsOptions {
  limit?: number;
  search?: string;
  resourceId?: string;
  resourceType?: string;
}

export interface CreateAgenticConversationInput {
  id?: string;
  title?: string;
  metadata?: JsonObject;
}

export interface AgenticChatClient {
  agenticFetch: <T>(url: string, init?: RequestInit) => Promise<T>;
  agenticMessagesUrl: (conversationId: string) => string;
  createAgenticPrompt: (
    input: AgenticPromptCreateInput,
  ) => Promise<AgenticPrompt>;
  createAgenticConversation: (
    input?: CreateAgenticConversationInput,
  ) => Promise<AgenticConversation>;
  deleteAgenticPrompt: (promptId: string) => Promise<void>;
  deleteAgenticConversation: (conversationId: string) => Promise<void>;
  ensureAgenticConversation: (
    input: Required<Pick<CreateAgenticConversationInput, 'id'>> &
      Omit<CreateAgenticConversationInput, 'id'>,
  ) => Promise<AgenticConversation>;
  getAgenticConversation: (
    conversationId: string,
  ) => Promise<AgenticConversation>;
  listAgenticConversations: (
    options?: ListAgenticConversationsOptions,
  ) => Promise<AgenticConversationListItem[]>;
  listAgenticMessages: (conversationId: string) => Promise<AgenticMessage[]>;
  listAgenticPrompts: (options?: {
    limit?: number;
    search?: string;
  }) => Promise<AgenticPrompt[]>;
  renderAgenticPrompt: (
    promptId: string,
    values: Record<string, string>,
  ) => Promise<{ prompt: AgenticPrompt; text: string }>;
  updateAgenticPrompt: (
    promptId: string,
    input: AgenticPromptUpdateInput,
  ) => Promise<AgenticPrompt>;
}

export function createAgenticChatClient(
  config: AgenticChatClientConfig,
): AgenticChatClient {
  const agenticConversationsUrl = () =>
    `${resolveBaseUrl(config.apiBaseUrl)}/agentic-chat/conversations`;
  const agenticConversationUrl = (conversationId: string) =>
    `${agenticConversationsUrl()}/${encodeURIComponent(conversationId)}`;
  const agenticMessagesUrl = (conversationId: string) =>
    `${agenticConversationUrl(conversationId)}/messages`;
  const agenticPromptsUrl = () =>
    `${resolveBaseUrl(config.apiBaseUrl)}/agentic-chat/prompts`;
  const agenticPromptUrl = (promptId: string) =>
    `${agenticPromptsUrl()}/${encodeURIComponent(promptId)}`;

  const agenticFetch = async <T>(
    url: string,
    init: RequestInit = {},
  ): Promise<T> => {
    const resolvedUrl = assertAgenticUrl(
      url,
      resolveBaseUrl(config.apiBaseUrl),
    );
    const headers = new Headers(init.headers);
    const authHeaders = await config.authHeaders?.(init);
    mergeHeaders(headers, authHeaders);

    const method = init.method?.toUpperCase() ?? 'GET';
    if (method === 'POST') {
      mergeHeaders(headers, await config.extraSendHeaders?.(init));
    }

    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const request = new Request(resolvedUrl, {
      cache: 'no-store',
      credentials: config.credentials,
      ...init,
      headers,
    });
    const response = await fetch(request);
    if (!response.ok) {
      throw new AgenticFetchError(
        await responseMessage(response),
        response.status,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  };

  const getAgenticConversation = (conversationId: string) =>
    agenticFetch<AgenticConversation>(agenticConversationUrl(conversationId));

  const createAgenticConversation = (
    input: CreateAgenticConversationInput = {},
  ) =>
    agenticFetch<AgenticConversation>(agenticConversationsUrl(), {
      method: 'POST',
      body: JSON.stringify(input),
    });

  const deleteAgenticConversation = (conversationId: string) =>
    agenticFetch<void>(agenticConversationUrl(conversationId), {
      method: 'DELETE',
    });

  return {
    agenticFetch,
    agenticMessagesUrl,
    createAgenticPrompt: (input) =>
      agenticFetch<AgenticPrompt>(agenticPromptsUrl(), {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    createAgenticConversation,
    deleteAgenticPrompt: (promptId) =>
      agenticFetch<void>(agenticPromptUrl(promptId), {
        method: 'DELETE',
      }),
    deleteAgenticConversation,
    ensureAgenticConversation: async (input) => {
      try {
        return await getAgenticConversation(input.id);
      } catch (caught) {
        if (!isAgenticFetchStatus(caught, 404)) throw caught;
      }

      try {
        return await createAgenticConversation(input);
      } catch (caught) {
        if (isAgenticFetchStatus(caught, 409)) {
          return getAgenticConversation(input.id);
        }

        throw caught;
      }
    },
    getAgenticConversation,
    listAgenticConversations: (options = {}) => {
      const params = new URLSearchParams();
      if (options.limit) params.set('limit', String(options.limit));
      if (options.search) params.set('q', options.search);
      if (options.resourceId) params.set('resourceId', options.resourceId);
      if (options.resourceType)
        params.set('resourceType', options.resourceType);

      const query = params.toString();
      return agenticFetch<AgenticConversationListItem[]>(
        `${agenticConversationsUrl()}${query ? `?${query}` : ''}`,
      );
    },
    listAgenticMessages: (conversationId) =>
      agenticFetch<AgenticMessage[]>(agenticMessagesUrl(conversationId)),
    listAgenticPrompts: (options = {}) => {
      const params = new URLSearchParams();
      if (options.limit) params.set('limit', String(options.limit));
      if (options.search) params.set('q', options.search);
      const query = params.toString();
      return agenticFetch<AgenticPrompt[]>(
        `${agenticPromptsUrl()}${query ? `?${query}` : ''}`,
      );
    },
    renderAgenticPrompt: (promptId, values) =>
      agenticFetch<{ prompt: AgenticPrompt; text: string }>(
        `${agenticPromptUrl(promptId)}/render`,
        {
          method: 'POST',
          body: JSON.stringify({ values }),
        },
      ),
    updateAgenticPrompt: (promptId, input) =>
      agenticFetch<AgenticPrompt>(agenticPromptUrl(promptId), {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  };
}

export function isAgenticFetchStatus(error: unknown, status: number): boolean {
  return error instanceof AgenticFetchError && error.status === status;
}

export class AgenticFetchError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'AgenticFetchError';
  }
}

function resolveBaseUrl(apiBaseUrl: string | (() => string)): string {
  const value = typeof apiBaseUrl === 'function' ? apiBaseUrl() : apiBaseUrl;
  return `${value.replace(/\/api\/?$/, '').replace(/\/$/, '')}/api`;
}

function assertAgenticUrl(url: string, baseUrl: string): URL {
  const trustedBase = new URL(baseUrl, globalThis.location?.origin);
  const resolvedUrl = new URL(url, trustedBase);

  if (
    resolvedUrl.origin !== trustedBase.origin ||
    !resolvedUrl.pathname.startsWith(
      `${trustedBase.pathname.replace(/\/$/, '')}/`,
    )
  ) {
    throw new AgenticFetchError('Blocked untrusted iGENTiC API URL.', 0);
  }

  return resolvedUrl;
}

function mergeHeaders(headers: Headers, value: HeadersInit | undefined): void {
  if (!value) return;
  new Headers(value).forEach((headerValue, key) => {
    headers.set(key, headerValue);
  });
}

async function responseMessage(response: Response): Promise<string> {
  const body = await response.text();
  if (!body) return `${response.status} ${response.statusText}`.trim();

  try {
    const parsed = JSON.parse(body) as { message?: unknown };
    if (typeof parsed.message === 'string') return parsed.message;
  } catch {
    return body;
  }

  return body;
}
