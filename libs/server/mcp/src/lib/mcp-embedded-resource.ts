export interface McpEmbeddedResource {
  type: 'resource';
  resource: { uri: string; text?: string; blob?: string; mimeType?: string };
  annotations?: { audience?: Array<'user' | 'assistant'>; priority?: number };
}
