import { AgenticFinishReason, AgenticUsage } from './agentic-usage.types';
import { AgenticProviderMetadata } from './json.types';

export type AgenticModelEvent =
  | AgenticStepStartEvent
  | AgenticTextStartEvent
  | AgenticTextDeltaEvent
  | AgenticTextEndEvent
  | AgenticReasoningStartEvent
  | AgenticReasoningDeltaEvent
  | AgenticReasoningEndEvent
  | AgenticToolInputStartEvent
  | AgenticToolInputDeltaEvent
  | AgenticToolInputEndEvent
  | AgenticToolCallEvent
  | AgenticToolResultEvent
  | AgenticToolErrorEvent
  | AgenticStepFinishEvent
  | AgenticFinishEvent
  | AgenticProviderErrorEvent;

export interface AgenticStepStartEvent {
  type: 'step-start';
  index: number;
  providerMetadata?: AgenticProviderMetadata;
}

export interface AgenticTextStartEvent {
  type: 'text-start';
  id: string;
  providerMetadata?: AgenticProviderMetadata;
}

export interface AgenticTextDeltaEvent {
  type: 'text-delta';
  id: string;
  text: string;
  providerMetadata?: AgenticProviderMetadata;
}

export interface AgenticTextEndEvent {
  type: 'text-end';
  id: string;
  providerMetadata?: AgenticProviderMetadata;
}

export interface AgenticReasoningStartEvent {
  type: 'reasoning-start';
  id: string;
  providerMetadata?: AgenticProviderMetadata;
}

export interface AgenticReasoningDeltaEvent {
  type: 'reasoning-delta';
  id: string;
  text: string;
  providerMetadata?: AgenticProviderMetadata;
}

export interface AgenticReasoningEndEvent {
  type: 'reasoning-end';
  id: string;
  providerMetadata?: AgenticProviderMetadata;
}

export interface AgenticToolInputStartEvent {
  type: 'tool-input-start';
  id: string;
  name: string;
  providerMetadata?: AgenticProviderMetadata;
}

export interface AgenticToolInputDeltaEvent {
  type: 'tool-input-delta';
  id: string;
  name: string;
  text: string;
  providerMetadata?: AgenticProviderMetadata;
}

export interface AgenticToolInputEndEvent {
  type: 'tool-input-end';
  id: string;
  name: string;
  providerMetadata?: AgenticProviderMetadata;
}

export interface AgenticToolCallEvent {
  type: 'tool-call';
  id: string;
  name: string;
  input: unknown;
  providerMetadata?: AgenticProviderMetadata;
}

export interface AgenticToolResultEvent {
  type: 'tool-result';
  id: string;
  name: string;
  result: unknown;
  resultText?: string;
  isError?: boolean;
  providerMetadata?: AgenticProviderMetadata;
}

export interface AgenticToolErrorEvent {
  type: 'tool-error';
  id: string;
  name: string;
  message: string;
  error?: unknown;
  providerMetadata?: AgenticProviderMetadata;
}

export interface AgenticStepFinishEvent {
  type: 'step-finish';
  index: number;
  reason: AgenticFinishReason;
  usage?: AgenticUsage;
  providerMetadata?: AgenticProviderMetadata;
}

export interface AgenticFinishEvent {
  type: 'finish';
  reason: AgenticFinishReason;
  usage?: AgenticUsage;
  providerMetadata?: AgenticProviderMetadata;
}

export interface AgenticProviderErrorEvent {
  type: 'provider-error';
  message: string;
  retryable?: boolean;
  providerMetadata?: AgenticProviderMetadata;
}
