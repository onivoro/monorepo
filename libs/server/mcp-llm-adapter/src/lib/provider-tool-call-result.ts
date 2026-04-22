/** Result of a single tool call in a batch. */
export interface ProviderToolCallResult {
  /** The provider-specific tool name that was called. */
  providerName: string;
  /** Pass-through of the id from the input, if provided. */
  id?: string;
  /** Stringified result on success, undefined on error. */
  result?: string;
  /** Error message on failure, undefined on success. */
  error?: string;
  /** Whether this call succeeded. */
  success: boolean;
}
