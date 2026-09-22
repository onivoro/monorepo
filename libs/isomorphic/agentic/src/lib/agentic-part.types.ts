import { AgenticProviderMetadata, JsonObject } from './json.types';

export type AgenticPartStatus =
  | 'pending'
  | 'streaming'
  | 'running'
  | 'complete'
  | 'error'
  | 'aborted';

export interface AgenticPartBase {
  id: string;
  status?: AgenticPartStatus;
  createdAt?: string;
  updatedAt?: string;
  providerMetadata?: AgenticProviderMetadata;
}

export interface AgenticTextPart extends AgenticPartBase {
  type: 'text';
  text: string;
}

export interface AgenticReasoningPart extends AgenticPartBase {
  type: 'reasoning';
  text: string;
}

export interface AgenticToolCallPart extends AgenticPartBase {
  type: 'tool-call';
  toolCallId: string;
  name: string;
  input?: unknown;
  inputText?: string;
}

export interface AgenticToolResultPart extends AgenticPartBase {
  type: 'tool-result';
  toolCallId: string;
  name: string;
  result: unknown;
  resultText?: string;
  isError?: boolean;
}

export interface AgenticFilePart extends AgenticPartBase {
  type: 'file';
  name: string;
  mimeType?: string;
  sizeBytes?: number;
  uri?: string;
  data?: string;
  metadata?: JsonObject;
}

export interface AgenticApprovalPart extends AgenticPartBase {
  type: 'approval';
  action: string;
  approved?: boolean;
  reason?: string;
  metadata?: JsonObject;
}

export interface AgenticErrorPart extends AgenticPartBase {
  type: 'error';
  message: string;
  code?: string;
  retryable?: boolean;
}

export interface AgenticSummaryPart extends AgenticPartBase {
  type: 'summary';
  text: string;
  sourceMessageIds?: string[];
}

export type AgenticPart =
  | AgenticTextPart
  | AgenticReasoningPart
  | AgenticToolCallPart
  | AgenticToolResultPart
  | AgenticFilePart
  | AgenticApprovalPart
  | AgenticErrorPart
  | AgenticSummaryPart;

export type AgenticDeltaField = 'text' | 'inputText' | 'resultText';
