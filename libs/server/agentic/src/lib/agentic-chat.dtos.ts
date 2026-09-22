import type {
  AgenticConversationStatus,
  JsonObject,
} from '@onivoro/isomorphic-agentic';

export interface SendAgenticMessageDto {
  text: string;
  metadata?: JsonObject;
}

export interface CreateAgenticConversationDto {
  id?: string;
  title?: string;
  metadata?: JsonObject;
}

export interface UpdateAgenticConversationDto {
  title?: string;
  status?: AgenticConversationStatus;
}

export interface CreateAgenticPromptDto {
  id?: string;
  title: string;
  prompt: string;
  metadata?: JsonObject;
}

export interface UpdateAgenticPromptDto {
  title?: string;
  prompt?: string;
  metadata?: JsonObject;
}

export interface RenderAgenticPromptDto {
  values: Record<string, string>;
}
