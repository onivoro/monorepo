import { JsonObject } from '@onivoro/isomorphic-agentic';

export interface AgenticChatConfig {
  maxModelSteps?: number;
  toolExecutionTimeoutMs?: number;
  maxToolResultTextLength?: number;
  defaultSystemPrompt?: string;
  metadata?: JsonObject;
}

export const DEFAULT_AGENTIC_CHAT_CONFIG: Required<
  Pick<
    AgenticChatConfig,
    'maxModelSteps' | 'toolExecutionTimeoutMs' | 'maxToolResultTextLength'
  >
> = {
  maxModelSteps: 6,
  toolExecutionTimeoutMs: 120_000,
  maxToolResultTextLength: 12_000,
};
