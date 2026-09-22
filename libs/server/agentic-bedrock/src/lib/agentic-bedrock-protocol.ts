import {
  AgenticModelEvent,
  AgenticModelRequest,
} from '@onivoro/isomorphic-agentic';

/**
 * Turns one model's Bedrock stream into the normalized event union.
 *
 * `parse` is called per chunk and may return any number of events, including
 * none. `finish` is called once the stream ends and must close anything still
 * open -- text blocks, reasoning blocks, partial tool arguments -- and emit the
 * terminal `step-finish` and `finish`.
 */
export interface IAgenticBedrockStreamParser {
  parse(chunk: unknown): AgenticModelEvent[];
  finish(): AgenticModelEvent[];
}

/**
 * Defaults the provider hands to a protocol, so a protocol never has to know
 * where configuration came from.
 */
export interface AgenticBedrockRequestDefaults {
  maxTokens: number;
  anthropicVersion: string;
  /**
   * Sampling parameters are rejected outright by current frontier models.
   * False means the protocol must not send `temperature` even when the request
   * carries one.
   */
  sendTemperature: boolean;
  thinking?: unknown;
  effort?: string;
}

/**
 * One model family's wire format: how a request is built, and how its stream is
 * read back. Everything else in the package is protocol-agnostic, so supporting
 * another model is this interface and nothing more.
 */
export interface IAgenticBedrockProtocol {
  readonly name: string;
  buildRequestBody(
    request: AgenticModelRequest,
    defaults: AgenticBedrockRequestDefaults,
  ): unknown;
  createParser(stepIndex: number): IAgenticBedrockStreamParser;
}
