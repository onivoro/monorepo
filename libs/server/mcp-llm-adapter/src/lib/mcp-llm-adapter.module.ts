import { DynamicModule, Module } from '@nestjs/common';
import { McpRegistryModule } from '@onivoro/server-mcp';
import { McpLlmToolAdapter } from './mcp-llm-tool-adapter';
import { LLM_ADAPTER_CONFIG } from './llm-adapter-config-token';
import type { LlmAdapterConfig } from './llm-adapter-config';
import { BEDROCK_CONVERSE_CONFIG } from './bedrock-converse-config';
import { OPENAI_CONFIG } from './openai-config';
import { CLAUDE_CONFIG } from './claude-config';
import { GEMINI_CONFIG } from './gemini-config';
import { MISTRAL_CONFIG } from './mistral-config';

@Module({})
export class McpLlmAdapterModule {
  static forProvider<T>(config: LlmAdapterConfig<T>): DynamicModule {
    return {
      module: McpLlmAdapterModule,
      imports: [McpRegistryModule.registerOnly()],
      providers: [
        McpLlmToolAdapter,
        { provide: LLM_ADAPTER_CONFIG, useValue: config },
      ],
      exports: [McpLlmToolAdapter],
    };
  }

  static forBedrockConverse(): DynamicModule {
    return this.forProvider(BEDROCK_CONVERSE_CONFIG);
  }

  static forOpenAi(): DynamicModule {
    return this.forProvider(OPENAI_CONFIG);
  }

  static forClaude(): DynamicModule {
    return this.forProvider(CLAUDE_CONFIG);
  }

  static forGemini(): DynamicModule {
    return this.forProvider(GEMINI_CONFIG);
  }

  static forMistral(): DynamicModule {
    return this.forProvider(MISTRAL_CONFIG);
  }
}
