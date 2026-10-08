import { Logger } from '@nestjs/common';
import { McpToolRegistry } from '@onivoro/server-mcp';
import { McpLlmToolAdapter } from './mcp-llm-tool-adapter';
import type { LlmAdapterConfig } from './llm-adapter-config';

const CONFIG: LlmAdapterConfig<{ name: string }> = {
  aliasKey: 'test',
  formatTool: (name) => ({ name }),
};

describe('McpLlmToolAdapter error reporting', () => {
  let registry: McpToolRegistry;
  let adapter: McpLlmToolAdapter<{ name: string }>;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    registry = new McpToolRegistry();
    adapter = new McpLlmToolAdapter(registry, CONFIG);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should stringify non-Error rejections in batch results', async () => {
    registry.registerTool({ name: 'throws-string', description: 'd' }, () =>
      Promise.reject('plain failure'),
    );
    registry.registerTool({ name: 'throws-object', description: 'd' }, () =>
      Promise.reject({ code: 42 }),
    );

    const results = await adapter.executeToolsForProvider([
      { providerName: 'throws-string', params: {}, id: 'a' },
      { providerName: 'throws-object', params: {}, id: 'b' },
    ]);

    expect(results).toEqual([
      {
        providerName: 'throws-string',
        id: 'a',
        error: 'plain failure',
        success: false,
      },
      {
        providerName: 'throws-object',
        id: 'b',
        error: '[object Object]',
        success: false,
      },
    ]);
  });

  it('should report schema validation failures as errors', async () => {
    const { z } = await import('zod');
    registry.registerTool(
      {
        name: 'typed',
        description: 'd',
        schema: z.object({ n: z.number() }),
      },
      async () => 'never',
    );

    const result = await adapter.executeToolCallForProvider({
      providerName: 'typed',
      params: { n: 'not a number' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('should propagate handler errors from executeToolForProvider', async () => {
    registry.registerTool({ name: 'boom', description: 'd' }, async () => {
      throw new Error('exploded');
    });

    await expect(adapter.executeToolForProvider('boom', {})).rejects.toThrow(
      'exploded',
    );
  });
});
