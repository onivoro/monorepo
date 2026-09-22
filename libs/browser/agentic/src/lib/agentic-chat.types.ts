import type {
  AgenticPrompt,
  AgenticPromptCreateInput,
  AgenticPromptUpdateInput,
  JsonObject,
} from '@onivoro/isomorphic-agentic';

export interface AgenticChatResourceContext {
  identifiers?: Record<string, string | number | boolean | null | undefined>;
  label?: string;
  metadata?: JsonObject;
  resourceId: string | number;
  resourceType: string;
}

export interface AgenticStarterAction {
  inputs?: AgenticStarterInput[];
  label: string;
  metadata?: JsonObject;
  prompt: string;
}

export interface AgenticStarterInput {
  defaultValue?: string;
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
}

export interface AgenticPromptLibraryClient {
  createPrompt: (input: AgenticPromptCreateInput) => Promise<AgenticPrompt>;
  deletePrompt: (promptId: string) => Promise<void>;
  listPrompts: (options?: {
    limit?: number;
    search?: string;
  }) => Promise<AgenticPrompt[]>;
  updatePrompt: (
    promptId: string,
    input: AgenticPromptUpdateInput,
  ) => Promise<AgenticPrompt>;
}

export type AgenticAuthHeadersProvider = (
  init: RequestInit,
) => HeadersInit | Promise<HeadersInit>;

export interface AgenticChatClientConfig {
  apiBaseUrl: string | (() => string);
  authHeaders?: AgenticAuthHeadersProvider;
  credentials?: RequestCredentials;
  extraSendHeaders?: AgenticAuthHeadersProvider;
}

export interface AgenticConversationRouteConfig {
  buildConversationPath: (conversationId: string) => string;
  conversationId?: string;
  localStorageKey: string;
  navigate: (path: string, options?: { replace?: boolean }) => void;
}
