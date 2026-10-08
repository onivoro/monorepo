import { Injectable, Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { McpTool, McpToolRegistry } from '@onivoro/server-mcp';
import { z } from 'zod';
import { McpLlmAdapterModule } from './mcp-llm-adapter.module';
import { McpLlmToolAdapter } from './mcp-llm-tool-adapter';
import { LLM_ADAPTER_CONFIG } from './llm-adapter-config-token';
import type { LlmAdapterConfig } from './llm-adapter-config';
import { BEDROCK_CONVERSE_CONFIG } from './bedrock-converse-config';
import { OPENAI_CONFIG } from './openai-config';
import { CLAUDE_CONFIG } from './claude-config';
import { GEMINI_CONFIG } from './gemini-config';
import { MISTRAL_CONFIG } from './mistral-config';
import { BEDROCK_MANTLE_CONFIG } from './bedrock-mantle-config';
import { BEDROCK_OPENAI_CONFIG } from './bedrock-openai-config';

@Injectable()
class WeatherService {
  @McpTool({
    name: 'get-weather',
    description: 'Get the weather',
    schema: z.object({ city: z.string() }),
    aliases: { claude: 'weather_lookup' },
  })
  async getWeather(params: { city: string }) {
    return { city: params.city, tempC: 21 };
  }
}

describe('McpLlmAdapterModule', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('forProvider', () => {
    it('should provide the adapter and config and import the registry module', () => {
      const config: LlmAdapterConfig = {
        aliasKey: 'custom',
        formatTool: (name) => ({ name }),
      };

      const dyn = McpLlmAdapterModule.forProvider(config);

      expect(dyn.module).toBe(McpLlmAdapterModule);
      expect(dyn.exports).toEqual([McpLlmToolAdapter]);
      expect(dyn.providers).toEqual([
        McpLlmToolAdapter,
        { provide: LLM_ADAPTER_CONFIG, useValue: config },
      ]);
      expect(dyn.imports).toHaveLength(1);
    });
  });

  describe.each([
    ['forBedrockConverse', BEDROCK_CONVERSE_CONFIG],
    ['forOpenAi', OPENAI_CONFIG],
    ['forClaude', CLAUDE_CONFIG],
    ['forGemini', GEMINI_CONFIG],
    ['forMistral', MISTRAL_CONFIG],
    ['forBedrockMantle', BEDROCK_MANTLE_CONFIG],
    ['forBedrockOpenAi', BEDROCK_OPENAI_CONFIG],
  ] as const)('%s', (factory, expectedConfig) => {
    it('should register the matching provider config', () => {
      const dyn = (McpLlmAdapterModule as any)[factory]();
      expect(dyn.providers).toContainEqual({
        provide: LLM_ADAPTER_CONFIG,
        useValue: expectedConfig,
      });
    });
  });

  describe('integration', () => {
    let module: TestingModule;

    afterEach(async () => {
      await module?.close();
    });

    it('should discover decorated tools and expose them in provider format', async () => {
      module = await Test.createTestingModule({
        imports: [McpLlmAdapterModule.forClaude()],
        providers: [WeatherService],
      }).compile();
      await module.init();

      const adapter = module.get(McpLlmToolAdapter);
      expect(adapter.toProviderTools()).toEqual([
        {
          name: 'weather_lookup',
          description: 'Get the weather',
          input_schema: expect.objectContaining({
            type: 'object',
            properties: { city: expect.objectContaining({ type: 'string' }) },
          }),
        },
      ]);
    });

    it('should execute discovered tools by provider name', async () => {
      module = await Test.createTestingModule({
        imports: [McpLlmAdapterModule.forClaude()],
        providers: [WeatherService],
      }).compile();
      await module.init();

      const adapter = module.get(McpLlmToolAdapter);
      await expect(
        adapter.executeToolForProvider('weather_lookup', { city: 'Oslo' }),
      ).resolves.toBe(JSON.stringify({ city: 'Oslo', tempC: 21 }));
    });

    it('should invalidate the name cache when tools are registered after init', async () => {
      module = await Test.createTestingModule({
        imports: [McpLlmAdapterModule.forOpenAi()],
      }).compile();
      await module.init();

      const adapter = module.get(McpLlmToolAdapter);
      expect(adapter.resolveProviderToolName('late-tool')).toBeUndefined();

      module
        .get(McpToolRegistry)
        .registerTool({ name: 'late-tool', description: 'd' }, async () => 'x');

      expect(adapter.resolveProviderToolName('late-tool')).toBe('late-tool');
    });
  });
});
