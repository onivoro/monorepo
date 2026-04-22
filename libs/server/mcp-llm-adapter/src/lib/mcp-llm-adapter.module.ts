import { DynamicModule, Module } from '@nestjs/common';
import { McpRegistryModule } from '@onivoro/server-mcp';
import { LlmToolAdapter } from './llm-tool-adapter';
import { LLM_ADAPTER_CONFIG, LlmAdapterConfig } from './llm-adapter.config';
import {
  BEDROCK_CONVERSE_CONFIG,
  OPENAI_CONFIG,
  CLAUDE_CONFIG,
  GEMINI_CONFIG,
  MISTRAL_CONFIG,
} from './provider-configs';

@Module({})
export class McpLlmAdapterModule {
  static forProvider<T>(config: LlmAdapterConfig<T>): DynamicModule {
    return {
      module: McpLlmAdapterModule,
      imports: [McpRegistryModule.registerOnly()],
      providers: [
        LlmToolAdapter,
        { provide: LLM_ADAPTER_CONFIG, useValue: config },
      ],
      exports: [LlmToolAdapter],
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
