import { BedrockMessagesStreamParser } from './bedrock-messages-stream-parser';
import { buildKimiK25MantleRequestBody } from './kimi-k25-mantle-protocol';

describe(BedrockMessagesStreamParser.name, () => {
  it('parses text deltas into neutral events', () => {
    const parser = new BedrockMessagesStreamParser(0, {
      nativeToolCallSyntax: true,
    });

    expect(
      parser.parse({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'hello' },
      }),
    ).toEqual([
      { type: 'text-start', id: 'text-0' },
      { type: 'text-delta', id: 'text-0', text: 'hello' },
    ]);

    expect(parser.parse({ type: 'content_block_stop', index: 0 })).toEqual([
      { type: 'text-end', id: 'text-0' },
    ]);
  });

  it('parses streamed tool calls', () => {
    const parser = new BedrockMessagesStreamParser(0, {
      nativeToolCallSyntax: true,
    });

    expect(
      parser.parse({
        type: 'content_block_start',
        index: 1,
        content_block: { type: 'tool_use', id: 'call-1', name: 'lookup' },
      }),
    ).toEqual([
      {
        type: 'tool-input-start',
        id: 'call-1',
        name: 'lookup',
        providerMetadata: expect.any(Object),
      },
    ]);

    parser.parse({
      type: 'content_block_delta',
      index: 1,
      delta: { type: 'input_json_delta', partial_json: '{"id":"123"}' },
    });

    expect(parser.parse({ type: 'content_block_stop', index: 1 })).toEqual([
      {
        type: 'tool-input-end',
        id: 'call-1',
        name: 'lookup',
        providerMetadata: expect.any(Object),
      },
      {
        type: 'tool-call',
        id: 'call-1',
        name: 'lookup',
        input: { id: '123' },
        providerMetadata: expect.any(Object),
      },
    ]);
  });

  it('parses OpenAI-compatible chat chunks from Bedrock Mantle', () => {
    const parser = new BedrockMessagesStreamParser(0, {
      nativeToolCallSyntax: true,
    });

    expect(
      parser.parse({
        choices: [
          {
            delta: { content: '', role: 'assistant' },
            finish_reason: null,
            index: 0,
          },
        ],
        object: 'chat.completion.chunk',
      }),
    ).toEqual([]);

    expect(
      parser.parse({
        choices: [
          {
            delta: { content: ' hello' },
            finish_reason: 'stop',
            index: 0,
          },
        ],
        object: 'chat.completion.chunk',
        'amazon-bedrock-invocationMetrics': {
          inputTokenCount: 32,
          outputTokenCount: 2,
        },
      }),
    ).toEqual([
      { type: 'text-start', id: 'text-0' },
      { type: 'text-delta', id: 'text-0', text: ' hello' },
    ]);

    expect(parser.finish()).toEqual([
      { type: 'text-end', id: 'text-0' },
      {
        type: 'step-finish',
        index: 0,
        reason: 'stop',
        usage: expect.objectContaining({
          inputTokens: 32,
          outputTokens: 2,
          totalTokens: 34,
        }),
      },
      {
        type: 'finish',
        reason: 'stop',
        usage: expect.objectContaining({
          inputTokens: 32,
          outputTokens: 2,
          totalTokens: 34,
        }),
      },
    ]);
  });

  it('parses Kimi native tool-call markers from OpenAI-compatible content chunks', () => {
    const parser = new BedrockMessagesStreamParser(0, {
      nativeToolCallSyntax: true,
    });

    expect(
      parser.parse({
        choices: [
          {
            delta: {
              content:
                '<|tool_calls_section_begin|><|tool_call_begin|>' +
                'functions.mcp__carevim__list-ivim-orders:2!' +
                '<|tool_call_argument_begin|>{}<|tool_call_end|>' +
                '<|tool_calls_section_end|>',
            },
            finish_reason: 'stop',
            index: 0,
          },
        ],
        object: 'chat.completion.chunk',
      }),
    ).toEqual([
      {
        type: 'tool-input-start',
        id: 'tool-0-10000',
        name: 'mcp__carevim__list-ivim-orders',
        providerMetadata: expect.any(Object),
      },
      {
        type: 'tool-input-delta',
        id: 'tool-0-10000',
        name: 'mcp__carevim__list-ivim-orders',
        text: '{}',
        providerMetadata: expect.any(Object),
      },
      {
        type: 'tool-input-end',
        id: 'tool-0-10000',
        name: 'mcp__carevim__list-ivim-orders',
        providerMetadata: expect.any(Object),
      },
      {
        type: 'tool-call',
        id: 'tool-0-10000',
        name: 'mcp__carevim__list-ivim-orders',
        input: {},
        providerMetadata: expect.any(Object),
      },
    ]);
  });

  it('does not leak split Kimi native tool-call markers as text', () => {
    const parser = new BedrockMessagesStreamParser(0, {
      nativeToolCallSyntax: true,
    });

    expect(
      parser.parse({
        choices: [
          {
            delta: {
              content: 'Checking orders. <|tool_calls_section_be',
            },
            finish_reason: null,
            index: 0,
          },
        ],
        object: 'chat.completion.chunk',
      }),
    ).toEqual([
      { type: 'text-start', id: 'text-0' },
      { type: 'text-delta', id: 'text-0', text: 'Checking orders. ' },
    ]);

    const events = parser.parse({
      choices: [
        {
          delta: {
            content:
              'gin|><|tool_call_begin|>functions.lookup!' +
              '<|tool_call_argument_begin|>{"id":"123"}' +
              '<|tool_call_end|><|tool_calls_section_end|>',
          },
          finish_reason: 'stop',
          index: 0,
        },
      ],
      object: 'chat.completion.chunk',
    });

    expect(JSON.stringify(events)).not.toContain('<|tool');
    expect(events).toEqual([
      {
        type: 'tool-input-start',
        id: 'tool-0-10000',
        name: 'lookup',
        providerMetadata: expect.any(Object),
      },
      {
        type: 'tool-input-delta',
        id: 'tool-0-10000',
        name: 'lookup',
        text: '{"id":"123"}',
        providerMetadata: expect.any(Object),
      },
      {
        type: 'tool-input-end',
        id: 'tool-0-10000',
        name: 'lookup',
        providerMetadata: expect.any(Object),
      },
      {
        type: 'tool-call',
        id: 'tool-0-10000',
        name: 'lookup',
        input: { id: '123' },
        providerMetadata: expect.any(Object),
      },
    ]);
  });
});

describe(buildKimiK25MantleRequestBody.name, () => {
  it('lowers agentic messages and tools to a Mantle request body', () => {
    expect(
      buildKimiK25MantleRequestBody({
        conversationId: 'conversation-1',
        runId: 'run-1',
        messages: [
          {
            id: 'message-1',
            conversationId: 'conversation-1',
            role: 'user',
            status: 'complete',
            parts: [{ id: 'part-1', type: 'text', text: 'hello' }],
            createdAt: '2026-05-30T00:00:00.000Z',
            updatedAt: '2026-05-30T00:00:00.000Z',
          },
        ],
        tools: [
          {
            name: 'lookup',
            description: 'Lookup a record',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      }),
    ).toMatchObject({
      messages: [{ role: 'user', content: 'hello' }],
      tools: [
        {
          type: 'function',
          function: { name: 'lookup' },
        },
      ],
    });
  });

  it('serializes undefined tool results as null content', () => {
    expect(
      buildKimiK25MantleRequestBody({
        conversationId: 'conversation-1',
        runId: 'run-1',
        messages: [
          {
            id: 'message-1',
            conversationId: 'conversation-1',
            role: 'tool',
            status: 'complete',
            parts: [
              {
                id: 'part-1',
                type: 'tool-result',
                toolCallId: 'call-1',
                name: 'lookup',
                result: undefined,
              },
            ],
            createdAt: '2026-05-30T00:00:00.000Z',
            updatedAt: '2026-05-30T00:00:00.000Z',
          },
        ],
      }),
    ).toMatchObject({
      messages: [
        {
          role: 'tool',
          tool_call_id: 'call-1',
          name: 'lookup',
          content: 'null',
        },
      ],
    });
  });
});
