import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { AGENTIC_MODEL_PROVIDER } from '@onivoro/server-agentic';
import { DynamicModule, Module } from '@nestjs/common';
import {
  AGENTIC_BEDROCK_CONFIG,
  AgenticBedrockConfig,
} from './agentic-bedrock-config';
import { BedrockModelProvider } from './bedrock-model-provider.service';

@Module({})
export class AgenticBedrockModule {
  static configure(config: AgenticBedrockConfig = {}): DynamicModule {
    return {
      module: AgenticBedrockModule,
      providers: [
        { provide: AGENTIC_BEDROCK_CONFIG, useValue: config },
        {
          provide: BedrockRuntimeClient,
          useValue: new BedrockRuntimeClient({ region: config.region }),
        },
        BedrockModelProvider,
        { provide: AGENTIC_MODEL_PROVIDER, useExisting: BedrockModelProvider },
      ],
      exports: [
        AGENTIC_BEDROCK_CONFIG,
        BedrockRuntimeClient,
        BedrockModelProvider,
        AGENTIC_MODEL_PROVIDER,
      ],
    };
  }
}
