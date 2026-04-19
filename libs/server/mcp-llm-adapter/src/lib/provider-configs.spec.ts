import { z } from 'zod';
import { McpToolRegistry } from '@onivoro/server-mcp';
import { LlmToolAdapter } from './llm-tool-adapter';
import {
  BEDROCK_CONVERSE_CONFIG,
  OPENAI_CONFIG,
  CLAUDE_CONFIG,
  GEMINI_CONFIG,
  MISTRAL_CONFIG,
} from './provider-configs';

describe('provider-configs', () => {
  const schema = z.object({
    text: z.string().describe('The text'),
    count: z.number().optional(),
  });

  let registry: McpToolRegistry;

  beforeEach(() => {
    registry = new McpToolRegistry();
    registry.registerTool(
      { name: 'insert-emojis', description: 'Insert emojis into text', schema },
      jest.fn(),
    );
  });

  describe('BEDROCK_CONVERSE_CONFIG', () => {
    it('should format as Bedrock Converse toolSpec with sanitized name', () => {
      const adapter = new LlmToolAdapter(registry, BEDROCK_CONVERSE_CONFIG);
      const tools = adapter.toProviderTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].toolSpec.name).toBe('insert_emojis');
      expect(tools[0].toolSpec.description).toBe('Insert emojis into text');
      expect(tools[0].toolSpec.inputSchema.json).toHaveProperty('type', 'object');
      expect(tools[0].toolSpec.inputSchema.json).toHaveProperty('properties');
    });

    it('should use explicit bedrock alias', () => {
      registry.registerTool(
        { name: 'other', description: 'd', aliases: { bedrock: 'myAlias' } },
        jest.fn(),
      );
      const adapter = new LlmToolAdapter(registry, BEDROCK_CONVERSE_CONFIG);
      const tools = adapter.toProviderTools();
      const other = tools.find((t) => t.toolSpec.name === 'myAlias');
      expect(other).toBeDefined();
    });
  });

  describe('OPENAI_CONFIG', () => {
    it('should format as OpenAI function definition', () => {
      const adapter = new LlmToolAdapter(registry, OPENAI_CONFIG);
      const tools = adapter.toProviderTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].type).toBe('function');
      expect(tools[0].function.name).toBe('insert-emojis');
      expect(tools[0].function.description).toBe('Insert emojis into text');
      expect(tools[0].function.parameters).toHaveProperty('type', 'object');
    });

    it('should use explicit openai alias', () => {
      registry.registerTool(
        { name: 'other', description: 'd', aliases: { openai: 'customFn' } },
        jest.fn(),
      );
      const adapter = new LlmToolAdapter(registry, OPENAI_CONFIG);
      const tools = adapter.toProviderTools();
      const other = tools.find((t) => t.function.name === 'customFn');
      expect(other).toBeDefined();
    });
  });

  describe('CLAUDE_CONFIG', () => {
    it('should format as Anthropic tool definition', () => {
      const adapter = new LlmToolAdapter(registry, CLAUDE_CONFIG);
      const tools = adapter.toProviderTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('insert-emojis');
      expect(tools[0].description).toBe('Insert emojis into text');
      expect(tools[0].input_schema).toHaveProperty('type', 'object');
    });

    it('should use explicit claude alias', () => {
      registry.registerTool(
        { name: 'other', description: 'd', aliases: { claude: 'custom' } },
        jest.fn(),
      );
      const adapter = new LlmToolAdapter(registry, CLAUDE_CONFIG);
      const tools = adapter.toProviderTools();
      const other = tools.find((t) => t.name === 'custom');
      expect(other).toBeDefined();
    });
  });

  describe('GEMINI_CONFIG', () => {
    it('should format as Gemini function declaration with sanitized name', () => {
      const adapter = new LlmToolAdapter(registry, GEMINI_CONFIG);
      const tools = adapter.toProviderTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('insert_emojis');
      expect(tools[0].description).toBe('Insert emojis into text');
      expect(tools[0].parameters).toHaveProperty('type', 'object');
    });

    it('should use explicit gemini alias', () => {
      registry.registerTool(
        { name: 'other', description: 'd', aliases: { gemini: 'geminiFn' } },
        jest.fn(),
      );
      const adapter = new LlmToolAdapter(registry, GEMINI_CONFIG);
      const tools = adapter.toProviderTools();
      const other = tools.find((t) => t.name === 'geminiFn');
      expect(other).toBeDefined();
    });
  });

  describe('MISTRAL_CONFIG', () => {
    it('should format as OpenAI-compatible function definition', () => {
      const adapter = new LlmToolAdapter(registry, MISTRAL_CONFIG);
      const tools = adapter.toProviderTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].type).toBe('function');
      expect(tools[0].function.name).toBe('insert-emojis');
      expect(tools[0].function.description).toBe('Insert emojis into text');
      expect(tools[0].function.parameters).toHaveProperty('type', 'object');
    });

    it('should use explicit mistral alias independently from openai', () => {
      registry.registerTool(
        {
          name: 'other',
          description: 'd',
          aliases: { openai: 'openAiName', mistral: 'mistralName' },
        },
        jest.fn(),
      );
      const adapter = new LlmToolAdapter(registry, MISTRAL_CONFIG);
      const tools = adapter.toProviderTools();
      const other = tools.find((t) => t.function.name === 'mistralName');
      expect(other).toBeDefined();
    });
  });
});
