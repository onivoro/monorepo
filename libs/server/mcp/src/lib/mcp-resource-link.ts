export interface McpResourceLink {
  type: 'resource_link';
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  annotations?: { audience?: Array<'user' | 'assistant'>; priority?: number };
}
