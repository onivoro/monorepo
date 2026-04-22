import type { McpResourceResult } from './mcp-resource-result';

export function wrapResourceResult(
  raw: unknown,
  uri: string,
  mimeType?: string,
): McpResourceResult {
  if (raw && typeof raw === 'object' && Array.isArray((raw as any).contents)) {
    return raw as McpResourceResult;
  }

  if (typeof raw === 'string') {
    return {
      contents: [{ uri, mimeType: mimeType ?? 'text/plain', text: raw }],
    };
  }

  return {
    contents: [
      {
        uri,
        mimeType: mimeType ?? 'application/json',
        text: JSON.stringify(raw, null, 2),
      },
    ],
  };
}
