import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import {
  AgenticModelEvent,
  AgenticModelRequest,
} from '@onivoro/isomorphic-agentic';
import { AgenticBedrockConfig } from './agentic-bedrock-config';
import { IAgenticBedrockProtocol } from './agentic-bedrock-protocol';
import { BedrockModelProvider } from './bedrock-model-provider.service';

const encoder = new TextEncoder();

const chunk = (value: unknown) => ({
  chunk: { bytes: encoder.encode(JSON.stringify(value)) },
});

async function* streamOf(events: unknown[]) {
  for (const event of events) yield event;
}

const baseRequest: AgenticModelRequest = {
  conversationId: 'c1',
  runId: 'r1',
  messages: [
    {
      id: 'm1',
      conversationId: 'c1',
      role: 'user',
      status: 'complete',
      parts: [{ id: 'p1', type: 'text', text: 'hi' }],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
};

function setup(config: AgenticBedrockConfig = {}, body?: unknown) {
  const send = jest.fn().mockResolvedValue({ body });
  const client = { send } as unknown as BedrockRuntimeClient;
  return { send, provider: new BedrockModelProvider(client, config) };
}

async function collect(
  iterable: AsyncIterable<AgenticModelEvent>,
): Promise<AgenticModelEvent[]> {
  const events: AgenticModelEvent[] = [];
  for await (const event of iterable) events.push(event);
  return events;
}

function sentCommand(send: jest.Mock): InvokeModelWithResponseStreamCommand {
  return send.mock.calls[0][0];
}

function sentBody(send: jest.Mock): Record<string, unknown> {
  return JSON.parse(sentCommand(send).input.body as string);
}

describe(BedrockModelProvider.name, () => {
  it('identifies as bedrock and defaults the model id', () => {
    const { provider } = setup();
    expect(provider.provider).toBe('bedrock');
    expect(provider.model).toBe('anthropic.claude-opus-5');
  });

  it('uses the configured model id', () => {
    const { provider } = setup({ modelId: 'us.anthropic.claude-opus-5' });
    expect(provider.model).toBe('us.anthropic.claude-opus-5');
  });

  it('streams a text response through the default Anthropic protocol', async () => {
    const { provider, send } = setup(
      {},
      streamOf([
        chunk({
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'hello' },
        }),
        chunk({ type: 'content_block_stop', index: 0 }),
        chunk({
          type: 'message_delta',
          delta: { stop_reason: 'end_turn' },
          usage: { input_tokens: 3, output_tokens: 2 },
        }),
      ]),
    );

    const events = await collect(provider.stream(baseRequest));

    expect(events.map((e) => e.type)).toEqual([
      'step-start',
      'text-start',
      'text-delta',
      'text-end',
      'step-finish',
      'finish',
    ]);
    expect(events[0]).toEqual({ type: 'step-start', index: 0 });
    expect(events[events.length - 1]).toMatchObject({
      type: 'finish',
      reason: 'stop',
      usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
    });

    const command = sentCommand(send);
    expect(command).toBeInstanceOf(InvokeModelWithResponseStreamCommand);
    expect(command.input).toMatchObject({
      modelId: 'anthropic.claude-opus-5',
      contentType: 'application/json',
      accept: 'application/json',
    });
    expect(sentBody(send)).toEqual({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 64_000,
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    });
  });

  it('passes config defaults to the protocol and the request signal to the client', async () => {
    const { provider, send } = setup(
      {
        defaultMaxTokens: 100,
        anthropicVersion: 'v-test',
        sendTemperature: true,
        thinking: { type: 'enabled' },
        effort: 'high',
      },
      streamOf([]),
    );
    const controller = new AbortController();

    await collect(
      provider.stream({
        ...baseRequest,
        temperature: 0.5,
        model: 'override-model',
        signal: controller.signal,
      }),
    );

    expect(sentBody(send)).toMatchObject({
      anthropic_version: 'v-test',
      max_tokens: 100,
      temperature: 0.5,
      thinking: { type: 'enabled' },
      output_config: { effort: 'high' },
    });
    expect(sentCommand(send).input.modelId).toBe('override-model');
    expect(send.mock.calls[0][1]).toEqual({ abortSignal: controller.signal });
  });

  it('uses a custom protocol and the request step index', async () => {
    const parse = jest.fn().mockReturnValue([{ type: 'text-delta' }]);
    const finish = jest.fn().mockReturnValue([{ type: 'finish' }]);
    const protocol: IAgenticBedrockProtocol = {
      name: 'custom',
      buildRequestBody: jest.fn().mockReturnValue({ custom: true }),
      createParser: jest.fn().mockReturnValue({ parse, finish }),
    };
    const { provider, send } = setup(
      { protocol },
      streamOf([chunk({ any: 'thing' })]),
    );

    const events = await collect(
      provider.stream({ ...baseRequest, stepIndex: 3 }),
    );

    expect(protocol.createParser).toHaveBeenCalledWith(3);
    expect(protocol.buildRequestBody).toHaveBeenCalledWith(
      expect.objectContaining({ stepIndex: 3 }),
      {
        maxTokens: 64_000,
        anthropicVersion: 'bedrock-2023-05-31',
        sendTemperature: false,
        thinking: undefined,
        effort: undefined,
      },
    );
    expect(parse).toHaveBeenCalledWith({ any: 'thing' });
    expect(sentBody(send)).toEqual({ custom: true });
    expect(events).toEqual([
      { type: 'step-start', index: 3 },
      { type: 'text-delta' },
      { type: 'finish' },
    ]);
  });

  it('prefers buildRequestBody from config over the protocol builder', async () => {
    const buildRequestBody = jest.fn().mockReturnValue({ escape: 'hatch' });
    const { provider, send } = setup({ buildRequestBody }, streamOf([]));

    await collect(provider.stream(baseRequest));

    expect(buildRequestBody).toHaveBeenCalledWith(baseRequest);
    expect(sentBody(send)).toEqual({ escape: 'hatch' });
  });

  it('surfaces mid-stream exceptions as retryable provider errors', async () => {
    const { provider } = setup(
      {},
      streamOf([
        { throttlingException: { message: 'slow down' } },
        { modelStreamErrorException: { reason: 'no message' } },
        {},
      ]),
    );

    const events = await collect(provider.stream(baseRequest));
    const errors = events.filter((e) => e.type === 'provider-error');

    expect(errors).toEqual([
      {
        type: 'provider-error',
        message: 'slow down',
        retryable: true,
        providerMetadata: {
          bedrock: { throttlingException: { message: 'slow down' } },
        },
      },
      {
        type: 'provider-error',
        message: JSON.stringify({ reason: 'no message' }),
        retryable: true,
        providerMetadata: expect.any(Object),
      },
    ]);
    expect(events[events.length - 1]).toMatchObject({ type: 'finish' });
  });

  it.each([
    'internalServerException',
    'modelTimeoutException',
    'validationException',
    'serviceUnavailableException',
  ])('recognises %s as a stream error', async (key) => {
    const { provider } = setup({}, streamOf([{ [key]: { message: key } }]));
    const events = await collect(provider.stream(baseRequest));
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'provider-error', message: key }),
    );
  });

  it('stops with an abort finish when the signal is aborted mid-stream', async () => {
    const controller = new AbortController();
    async function* body() {
      yield chunk({
        type: 'content_block_delta',
        index: 0,
        delta: { text: 'a' },
      });
      controller.abort();
      yield chunk({
        type: 'content_block_delta',
        index: 0,
        delta: { text: 'b' },
      });
    }
    const { provider } = setup({}, body());

    const events = await collect(
      provider.stream({ ...baseRequest, signal: controller.signal }),
    );

    expect(events).toEqual([
      { type: 'step-start', index: 0 },
      { type: 'text-start', id: 'text-0' },
      { type: 'text-delta', id: 'text-0', text: 'a' },
      { type: 'finish', reason: 'abort' },
    ]);
  });

  it('treats a missing response body as an empty stream', async () => {
    const { provider } = setup({}, undefined);
    const events = await collect(provider.stream(baseRequest));
    expect(events.map((e) => e.type)).toEqual([
      'step-start',
      'step-finish',
      'finish',
    ]);
  });

  it('propagates a rejected send', async () => {
    const send = jest.fn().mockRejectedValue(new Error('AccessDenied'));
    const provider = new BedrockModelProvider(
      { send } as unknown as BedrockRuntimeClient,
      {},
    );
    await expect(collect(provider.stream(baseRequest))).rejects.toThrow(
      'AccessDenied',
    );
  });
});
