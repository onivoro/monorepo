export interface McpTextContent {
  type: 'text';
  text: string;
  annotations?: { audience?: Array<'user' | 'assistant'>; priority?: number };
}
