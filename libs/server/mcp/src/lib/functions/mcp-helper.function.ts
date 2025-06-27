import { McpResponse, McpContent } from '../interfaces/mcp-config.interface';

export function createMcpResponse<T>(data: T, success = true) {
  return {
    success,
    data,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Creates a standardized MCP text response
 */
export function createMcpTextResponse(text: string): McpResponse {
  return {
    content: [{
      type: 'text',
      text
    }]
  };
}

/**
 * Creates an MCP error response
 */
export function createMcpErrorResponse(error: string | Error): McpResponse {
  const errorMessage = error instanceof Error ? error.message : error;
  return {
    content: [{
      type: 'text',
      text: `❌ Error: ${errorMessage}`
    }]
  };
}

/**
 * Auto-wraps return values in MCP format
 */
export function wrapMcpResponse(result: any): McpResponse {
  // If already in MCP format, return as-is
  if (result && typeof result === 'object' && result.content) {
    return result;
  }
  
  // Auto-wrap simple return values
  return {
    content: [{
      type: 'text',
      text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
    }]
  };
}

/**
 * Creates MCP response with multiple content items
 */
export function createMcpMultiResponse(contents: McpContent[]): McpResponse {
  return { content: contents };
}