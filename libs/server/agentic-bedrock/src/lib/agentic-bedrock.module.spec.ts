import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { AGENTIC_MODEL_PROVIDER } from '@onivoro/server-agentic';
import { Test } from '@nestjs/testing';
import { AGENTIC_BEDROCK_CONFIG } from './agentic-bedrock-config';
import { AgenticBedrockModule } from './agentic-bedrock.module';
import { BedrockModelProvider } from './bedrock-model-provider.service';

describe(AgenticBedrockModule.name, () => {
  it('wires the config, client and provider, aliasing the model provider token', async () => {
    const config = { region: 'us-west-2', modelId: 'm' };
    const moduleRef = await Test.createTestingModule({
      imports: [AgenticBedrockModule.configure(config)],
    }).compile();

    expect(moduleRef.get(AGENTIC_BEDROCK_CONFIG)).toBe(config);
    expect(moduleRef.get(BedrockRuntimeClient)).toBeInstanceOf(
      BedrockRuntimeClient,
    );
    const provider = moduleRef.get(BedrockModelProvider);
    expect(provider.model).toBe('m');
    expect(moduleRef.get(AGENTIC_MODEL_PROVIDER)).toBe(provider);
  });

  it('defaults to an empty config', () => {
    const dynamic = AgenticBedrockModule.configure();
    expect(dynamic.module).toBe(AgenticBedrockModule);
    expect(dynamic.providers).toContainEqual({
      provide: AGENTIC_BEDROCK_CONFIG,
      useValue: {},
    });
    expect(dynamic.exports).toEqual([
      AGENTIC_BEDROCK_CONFIG,
      BedrockRuntimeClient,
      BedrockModelProvider,
      AGENTIC_MODEL_PROVIDER,
    ]);
  });
});
