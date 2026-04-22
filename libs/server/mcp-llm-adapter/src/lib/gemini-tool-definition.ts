export interface GeminiToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}
