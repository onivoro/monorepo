import type { McpPromptResult } from './mcp-prompt-result';

export function wrapPromptResult(raw: unknown): McpPromptResult {
  if (raw && typeof raw === 'object' && Array.isArray((raw as any).messages)) {
    return raw as McpPromptResult;
  }

  if (typeof raw === 'string') {
    return {
      messages: [{ role: 'user', content: { type: 'text', text: raw } }],
    };
  }

  return {
    messages: [
      {
        role: 'user',
        content: { type: 'text', text: JSON.stringify(raw, null, 2) },
      },
    ],
  };
}
