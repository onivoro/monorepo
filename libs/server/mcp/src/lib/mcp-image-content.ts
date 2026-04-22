export interface McpImageContent {
  type: 'image';
  data: string;
  mimeType: string;
  annotations?: { audience?: Array<'user' | 'assistant'>; priority?: number };
}
