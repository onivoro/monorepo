import { JsonObject } from './json.types';

export interface AgenticPromptParameter {
  name: string;
  label: string;
  required: boolean;
}

export interface AgenticPrompt {
  id: string;
  ownerParticipantId: string;
  title: string;
  prompt: string;
  parameters: AgenticPromptParameter[];
  metadata?: JsonObject;
  createdAt: string;
  updatedAt: string;
}

export interface AgenticPromptCreateInput {
  id?: string;
  title: string;
  prompt: string;
  metadata?: JsonObject;
}

export interface AgenticPromptUpdateInput {
  title?: string;
  prompt?: string;
  metadata?: JsonObject;
}

export interface AgenticPromptRenderInput {
  prompt: AgenticPrompt;
  values: Record<string, string>;
}
