import { z } from 'zod';
import { McpToolRegistry } from '@onivoro/server-mcp';
import { McpLlmToolAdapter } from './mcp-llm-tool-adapter';
import { BEDROCK_CONVERSE_CONFIG } from './bedrock-converse-config';
import { OPENAI_CONFIG } from './openai-config';
import { CLAUDE_CONFIG } from './claude-config';
import { GEMINI_CONFIG } from './gemini-config';
import { MISTRAL_CONFIG } from './mistral-config';
import { BEDROCK_MANTLE_CONFIG } from './bedrock-mantle-config';
import { BEDROCK_OPENAI_CONFIG } from './bedrock-openai-config';

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
      const adapter = new McpLlmToolAdapter(registry, BEDROCK_CONVERSE_CONFIG);
      const tools = adapter.toProviderTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].toolSpec.name).toBe('insert_emojis');
      expect(tools[0].toolSpec.description).toBe('Insert emojis into text');
      expect(tools[0].toolSpec.inputSchema.json).toHaveProperty(
        'type',
        'object',
      );
      expect(tools[0].toolSpec.inputSchema.json).toHaveProperty('properties');
    });

    it('should sanitize all non-alphanumeric/underscore characters', () => {
      registry.registerTool(
        { name: 'my.tool:v2-beta', description: 'd' },
        jest.fn(),
      );
      const adapter = new McpLlmToolAdapter(registry, BEDROCK_CONVERSE_CONFIG);
      const tools = adapter.toProviderTools();
      const sanitized = tools.find(
        (t) => t.toolSpec.name === 'my_tool_v2_beta',
      );
      expect(sanitized).toBeDefined();
    });

    it('should use explicit bedrock alias', () => {
      registry.registerTool(
        {
          name: 'other',
          description: 'd',
          aliases: { 'bedrock-converse': 'myAlias' },
        },
        jest.fn(),
      );
      const adapter = new McpLlmToolAdapter(registry, BEDROCK_CONVERSE_CONFIG);
      const tools = adapter.toProviderTools();
      const other = tools.find((t) => t.toolSpec.name === 'myAlias');
      expect(other).toBeDefined();
    });
  });

  describe('OPENAI_CONFIG', () => {
    it('should format as OpenAI function definition', () => {
      const adapter = new McpLlmToolAdapter(registry, OPENAI_CONFIG);
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
      const adapter = new McpLlmToolAdapter(registry, OPENAI_CONFIG);
      const tools = adapter.toProviderTools();
      const other = tools.find((t) => t.function.name === 'customFn');
      expect(other).toBeDefined();
    });
  });

  describe('CLAUDE_CONFIG', () => {
    it('should format as Anthropic tool definition', () => {
      const adapter = new McpLlmToolAdapter(registry, CLAUDE_CONFIG);
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
      const adapter = new McpLlmToolAdapter(registry, CLAUDE_CONFIG);
      const tools = adapter.toProviderTools();
      const other = tools.find((t) => t.name === 'custom');
      expect(other).toBeDefined();
    });
  });

  describe('GEMINI_CONFIG', () => {
    it('should format as Gemini function declaration with sanitized name', () => {
      const adapter = new McpLlmToolAdapter(registry, GEMINI_CONFIG);
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
      const adapter = new McpLlmToolAdapter(registry, GEMINI_CONFIG);
      const tools = adapter.toProviderTools();
      const other = tools.find((t) => t.name === 'geminiFn');
      expect(other).toBeDefined();
    });
  });

  describe('MISTRAL_CONFIG', () => {
    it('should format as OpenAI-compatible function definition', () => {
      const adapter = new McpLlmToolAdapter(registry, MISTRAL_CONFIG);
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
      const adapter = new McpLlmToolAdapter(registry, MISTRAL_CONFIG);
      const tools = adapter.toProviderTools();
      const other = tools.find((t) => t.function.name === 'mistralName');
      expect(other).toBeDefined();
    });
  });

  describe('BEDROCK_MANTLE_CONFIG', () => {
    it('should format as Anthropic tool definition', () => {
      const adapter = new McpLlmToolAdapter(registry, BEDROCK_MANTLE_CONFIG);
      const tools = adapter.toProviderTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('insert-emojis');
      expect(tools[0].description).toBe('Insert emojis into text');
      expect(tools[0].input_schema).toHaveProperty('type', 'object');
    });

    it('should use explicit bedrock-mantle alias', () => {
      registry.registerTool(
        {
          name: 'other',
          description: 'd',
          aliases: { 'bedrock-mantle': 'mantleName' },
        },
        jest.fn(),
      );
      const adapter = new McpLlmToolAdapter(registry, BEDROCK_MANTLE_CONFIG);
      const tools = adapter.toProviderTools();
      const other = tools.find((t) => t.name === 'mantleName');
      expect(other).toBeDefined();
    });

    it('should use bedrock-mantle alias independently from claude', () => {
      registry.registerTool(
        {
          name: 'other',
          description: 'd',
          aliases: { claude: 'claudeName', 'bedrock-mantle': 'mantleName' },
        },
        jest.fn(),
      );
      const adapter = new McpLlmToolAdapter(registry, BEDROCK_MANTLE_CONFIG);
      const tools = adapter.toProviderTools();
      const other = tools.find((t) => t.name === 'mantleName');
      expect(other).toBeDefined();
    });
  });

  describe('BEDROCK_OPENAI_CONFIG', () => {
    it('should format as OpenAI function definition', () => {
      const adapter = new McpLlmToolAdapter(registry, BEDROCK_OPENAI_CONFIG);
      const tools = adapter.toProviderTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].type).toBe('function');
      expect(tools[0].function.name).toBe('insert-emojis');
      expect(tools[0].function.description).toBe('Insert emojis into text');
      expect(tools[0].function.parameters).toHaveProperty('type', 'object');
    });

    it('should use explicit bedrock-openai alias', () => {
      registry.registerTool(
        {
          name: 'other',
          description: 'd',
          aliases: { 'bedrock-openai': 'brOpenAi' },
        },
        jest.fn(),
      );
      const adapter = new McpLlmToolAdapter(registry, BEDROCK_OPENAI_CONFIG);
      const tools = adapter.toProviderTools();
      const other = tools.find((t) => t.function.name === 'brOpenAi');
      expect(other).toBeDefined();
    });

    it('should use bedrock-openai alias independently from openai', () => {
      registry.registerTool(
        {
          name: 'other',
          description: 'd',
          aliases: { openai: 'openAiName', 'bedrock-openai': 'brOpenAiName' },
        },
        jest.fn(),
      );
      const adapter = new McpLlmToolAdapter(registry, BEDROCK_OPENAI_CONFIG);
      const tools = adapter.toProviderTools();
      const other = tools.find((t) => t.function.name === 'brOpenAiName');
      expect(other).toBeDefined();
    });
  });
});
