export interface McpAudioContent {
  type: 'audio';
  data: string;
  mimeType: string;
  annotations?: { audience?: Array<'user' | 'assistant'>; priority?: number };
}
