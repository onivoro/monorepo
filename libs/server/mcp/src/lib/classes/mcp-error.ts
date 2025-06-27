export class McpError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'McpError';
  }
}