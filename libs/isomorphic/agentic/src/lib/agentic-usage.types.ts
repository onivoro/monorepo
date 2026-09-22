import { AgenticProviderMetadata } from './json.types';

export interface AgenticUsage {
  inputTokens?: number;
  outputTokens?: number;
  nonCachedInputTokens?: number;
  cacheReadInputTokens?: number;
  cacheWriteInputTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
  providerMetadata?: AgenticProviderMetadata;
}

export type AgenticFinishReason =
  | 'stop'
  | 'length'
  | 'tool-calls'
  | 'content-filter'
  | 'error'
  | 'abort'
  | 'unknown';

export function mergeAgenticUsage(
  first?: AgenticUsage,
  second?: AgenticUsage,
): AgenticUsage | undefined {
  if (!first) return second;
  if (!second) return first;

  return {
    inputTokens: sumOptional(first.inputTokens, second.inputTokens),
    outputTokens: sumOptional(first.outputTokens, second.outputTokens),
    nonCachedInputTokens: sumOptional(
      first.nonCachedInputTokens,
      second.nonCachedInputTokens,
    ),
    cacheReadInputTokens: sumOptional(
      first.cacheReadInputTokens,
      second.cacheReadInputTokens,
    ),
    cacheWriteInputTokens: sumOptional(
      first.cacheWriteInputTokens,
      second.cacheWriteInputTokens,
    ),
    reasoningTokens: sumOptional(first.reasoningTokens, second.reasoningTokens),
    totalTokens: sumOptional(first.totalTokens, second.totalTokens),
    providerMetadata: {
      ...(first.providerMetadata ?? {}),
      ...(second.providerMetadata ?? {}),
    },
  };
}

function sumOptional(first?: number, second?: number): number | undefined {
  if (first === undefined) return second;
  if (second === undefined) return first;
  return first + second;
}
