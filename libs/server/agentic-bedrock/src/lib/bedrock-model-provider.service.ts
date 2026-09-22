import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import {
  AgenticModelEvent,
  AgenticModelProvider,
  AgenticModelRequest,
} from '@onivoro/isomorphic-agentic';
import { Inject, Injectable } from '@nestjs/common';
import {
  AGENTIC_BEDROCK_CONFIG,
  AgenticBedrockConfig,
  DEFAULT_AGENTIC_BEDROCK_CONFIG,
} from './agentic-bedrock-config';
import { AgenticBedrockRequestDefaults } from './agentic-bedrock-protocol';
import { anthropicMessagesProtocol } from './anthropic-messages-protocol';

@Injectable()
export class BedrockModelProvider implements AgenticModelProvider {
  readonly provider = 'bedrock';

  constructor(
    private readonly client: BedrockRuntimeClient,
    @Inject(AGENTIC_BEDROCK_CONFIG)
    private readonly config: AgenticBedrockConfig,
  ) {}

  get model(): string {
    return this.config.modelId ?? DEFAULT_AGENTIC_BEDROCK_CONFIG.modelId;
  }

  async *stream(
    request: AgenticModelRequest,
  ): AsyncIterable<AgenticModelEvent> {
    const protocol = this.config.protocol ?? anthropicMessagesProtocol;
    const stepIndex = request.stepIndex ?? 0;
    const parser = protocol.createParser(stepIndex);

    const body = this.config.buildRequestBody
      ? this.config.buildRequestBody(request)
      : protocol.buildRequestBody(request, this.requestDefaults());

    yield { type: 'step-start', index: stepIndex };

    const response = await this.client.send(
      new InvokeModelWithResponseStreamCommand({
        modelId: request.model ?? this.model,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(body),
      }),
      { abortSignal: request.signal },
    );

    for await (const event of response.body ?? []) {
      if (request.signal?.aborted) {
        yield { type: 'finish', reason: 'abort' };
        return;
      }

      if (event.chunk?.bytes) {
        const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes));
        for (const parsed of parser.parse(chunk)) yield parsed;
        continue;
      }

      const errorMessage = extractBedrockStreamError(event);
      if (errorMessage) {
        yield {
          type: 'provider-error',
          message: errorMessage,
          retryable: true,
          providerMetadata: { bedrock: event },
        };
      }
    }

    for (const event of parser.finish()) yield event;
  }

  private requestDefaults(): AgenticBedrockRequestDefaults {
    return {
      maxTokens:
        this.config.defaultMaxTokens ??
        DEFAULT_AGENTIC_BEDROCK_CONFIG.defaultMaxTokens,
      anthropicVersion:
        this.config.anthropicVersion ??
        DEFAULT_AGENTIC_BEDROCK_CONFIG.anthropicVersion,
      sendTemperature:
        this.config.sendTemperature ??
        DEFAULT_AGENTIC_BEDROCK_CONFIG.sendTemperature,
      thinking: this.config.thinking,
      effort: this.config.effort,
    };
  }
}

/**
 * Bedrock reports mid-stream failures as members on the event rather than by
 * rejecting the request, so a stream that has already started can still fail
 * and must be surfaced rather than read as a clean end.
 */
function extractBedrockStreamError(
  event: Record<string, any>,
): string | undefined {
  const value =
    event.internalServerException ??
    event.modelStreamErrorException ??
    event.modelTimeoutException ??
    event.throttlingException ??
    event.validationException ??
    event.serviceUnavailableException ??
    undefined;
  if (!value) return undefined;
  return value.message ?? JSON.stringify(value);
}
