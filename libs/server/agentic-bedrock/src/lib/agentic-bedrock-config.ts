import { AgenticModelRequest } from '@onivoro/isomorphic-agentic';
import { IAgenticBedrockProtocol } from './agentic-bedrock-protocol';

export const AGENTIC_BEDROCK_CONFIG = 'AGENTIC_BEDROCK_CONFIG';

export interface AgenticBedrockConfig {
  /** AWS region. Falls back to the SDK's own resolution when omitted. */
  region?: string;

  /**
   * What `InvokeModelWithResponseStream` receives as its model id.
   *
   * Normally an inference profile rather than a bare foundation model --
   * `us.anthropic.claude-opus-5` rather than `anthropic.claude-opus-5` -- since
   * system-defined profiles spread capacity across regions. Note that a
   * cross-region profile must be granted in IAM as BOTH the profile ARN and the
   * underlying foundation model with a wildcard region; granting one without
   * the other fails as AccessDeniedException without saying which is missing.
   */
  modelId?: string;

  /** Wire format. Defaults to the Anthropic Messages API. */
  protocol?: IAgenticBedrockProtocol;

  /** Used when a request does not carry its own `maxTokens`. */
  defaultMaxTokens?: number;

  /** Bedrock's Anthropic API version header value. */
  anthropicVersion?: string;

  /**
   * Send `temperature` when a request carries one.
   *
   * Off by default, and that default is load-bearing: current frontier models
   * reject sampling parameters with a 400 rather than ignoring them. Turn it on
   * only for a model known to accept them.
   */
  sendTemperature?: boolean;

  /**
   * Extended thinking configuration, passed through untouched.
   *
   * Omitted by default. Support and accepted shape vary by model and lag the
   * first-party API on Bedrock, so verify against the model you target before
   * setting it -- an unsupported value is a 400 on every request, not a
   * degraded response.
   */
  thinking?: unknown;

  /**
   * `output_config.effort`, passed through untouched. Omitted by default, and
   * subject to the same verify-first caveat as `thinking`.
   */
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';

  /**
   * Full escape hatch. When set, this replaces the protocol's request builder
   * entirely -- for a model whose body shape nothing here anticipates.
   */
  buildRequestBody?: (request: AgenticModelRequest) => unknown;
}

export const DEFAULT_AGENTIC_BEDROCK_CONFIG = {
  modelId: 'anthropic.claude-opus-5',
  /**
   * Generous because this provider always streams: the HTTP-timeout pressure
   * that argues for a small ceiling on a unary request does not apply.
   */
  defaultMaxTokens: 64_000,
  anthropicVersion: 'bedrock-2023-05-31',
  sendTemperature: false,
} as const;
