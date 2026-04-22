export interface LlmAdapterConfig<T = unknown> {
  aliasKey: string;
  sanitizeName?: (name: string) => string;
  formatTool: (
    name: string,
    description: string,
    jsonSchema: Record<string, unknown>,
  ) => T;
  /**
   * Optional extended formatter that also receives the output JSON Schema.
   * Called instead of `formatTool` when both the config defines this callback
   * AND the tool has an `outputSchema` in its MCP metadata.
   *
   * No current LLM provider API supports per-tool output schemas natively,
   * so built-in configs omit this. Use it for custom providers or when a
   * provider adds output schema support in the future.
   */
  formatToolWithOutput?: (
    name: string,
    description: string,
    inputSchema: Record<string, unknown>,
    outputSchema: Record<string, unknown>,
  ) => T;
}
