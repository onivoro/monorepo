/** A single tool call in a batch request. */
export interface ProviderToolCall {
  /** Tool name as returned by the LLM provider (may be sanitized/aliased). */
  providerName: string;
  /** Parameters for the tool call. */
  params: Record<string, unknown>;
  /** Optional identifier from the provider (e.g. OpenAI tool_call.id, Claude tool_use.id, Bedrock toolUseId). Pass-through for correlation. */
  id?: string;
}
