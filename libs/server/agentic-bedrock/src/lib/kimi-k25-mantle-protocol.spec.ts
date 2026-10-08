import { AgenticMessage } from '@onivoro/isomorphic-agentic';
import { BedrockMessagesStreamParser } from './bedrock-messages-stream-parser';
import {
  buildKimiK25MantleRequestBody,
  kimiK25MantleProtocol,
  toKimiK25MantleMessages,
  toKimiK25MantleTool,
} from './kimi-k25-mantle-protocol';

const message = (
  role: AgenticMessage['role'],
  parts: AgenticMessage['parts'],
): AgenticMessage => ({
  id: `${role}-1`,
  conversationId: 'c1',
  role,
  status: 'complete',
  parts,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('toKimiK25MantleMessages', () => {
  it('maps summary messages to a system message of their text', () => {
    expect(
      toKimiK25MantleMessages(
        message('summary', [{ id: 't', type: 'text', text: 'so far' }]),
      ),
    ).toEqual([{ role: 'system', content: 'so far' }]);
  });

  it('maps a summary part to system content', () => {
    expect(
      toKimiK25MantleMessages(
        message('summary', [{ id: 's', type: 'summary', text: 'recap' }]),
      ),
    ).toEqual([{ role: 'system', content: 'recap' }]);
  });

  it('maps system and user messages, concatenating text and reasoning parts', () => {
    expect(
      toKimiK25MantleMessages(
        message('system', [{ id: 't', type: 'text', text: 'be brief' }]),
      ),
    ).toEqual([{ role: 'system', content: 'be brief' }]);

    expect(
      toKimiK25MantleMessages(
        message('user', [
          { id: 'a', type: 'text', text: 'a' },
          { id: 'r', type: 'reasoning', text: 'b' },
          { id: 'f', type: 'file', name: 'ignored.txt' },
        ]),
      ),
    ).toEqual([{ role: 'user', content: 'ab' }]);
  });

  it('maps tool messages to one tool message per result, preferring resultText', () => {
    expect(
      toKimiK25MantleMessages(
        message('tool', [
          {
            id: 'r1',
            type: 'tool-result',
            toolCallId: 'call-1',
            name: 'lookup',
            result: { a: 1 },
            resultText: 'text form',
          },
          {
            id: 'r2',
            type: 'tool-result',
            toolCallId: 'call-2',
            name: 'echo',
            result: 'plain',
          },
          {
            id: 'r3',
            type: 'tool-result',
            toolCallId: 'call-3',
            name: 'obj',
            result: { b: 2 },
          },
          { id: 'x', type: 'text', text: 'not a result' },
        ]),
      ),
    ).toEqual([
      {
        role: 'tool',
        tool_call_id: 'call-1',
        name: 'lookup',
        content: 'text form',
      },
      { role: 'tool', tool_call_id: 'call-2', name: 'echo', content: 'plain' },
      {
        role: 'tool',
        tool_call_id: 'call-3',
        name: 'obj',
        content: JSON.stringify({ b: 2 }, null, 2),
      },
    ]);
  });

  it('falls back to String() for unserialisable tool results', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    const [result] = toKimiK25MantleMessages(
      message('tool', [
        {
          id: 'r',
          type: 'tool-result',
          toolCallId: 'c',
          name: 'n',
          result: circular,
        },
      ]),
    );
    expect(result.content).toBe('[object Object]');
  });

  it('maps assistant tool calls with input, skipping ones without', () => {
    expect(
      toKimiK25MantleMessages(
        message('assistant', [
          { id: 't', type: 'text', text: 'calling' },
          {
            id: 'c1',
            type: 'tool-call',
            toolCallId: 'call-1',
            name: 'lookup',
            input: { id: 1 },
          },
          {
            id: 'c2',
            type: 'tool-call',
            toolCallId: 'call-2',
            name: 'raw',
            input: '{"x":1}',
          },
          {
            id: 'c3',
            type: 'tool-call',
            toolCallId: 'call-3',
            name: 'pending',
          },
        ]),
      ),
    ).toEqual([
      {
        role: 'assistant',
        content: 'calling',
        tool_calls: [
          {
            id: 'call-1',
            type: 'function',
            function: {
              name: 'lookup',
              arguments: JSON.stringify({ id: 1 }, null, 2),
            },
          },
          {
            id: 'call-2',
            type: 'function',
            function: { name: 'raw', arguments: '{"x":1}' },
          },
        ],
      },
    ]);
  });

  it('omits empty assistant content and tool_calls', () => {
    expect(toKimiK25MantleMessages(message('assistant', []))).toEqual([
      { role: 'assistant', content: undefined, tool_calls: undefined },
    ]);
  });
});

describe('toKimiK25MantleTool', () => {
  it('wraps a tool definition as an OpenAI function', () => {
    expect(
      toKimiK25MantleTool({
        name: 'lookup',
        description: 'find',
        inputSchema: { type: 'object' },
      }),
    ).toEqual({
      type: 'function',
      function: {
        name: 'lookup',
        description: 'find',
        parameters: { type: 'object' },
      },
    });
  });
});

describe('buildKimiK25MantleRequestBody', () => {
  it('omits the system message and tools when absent', () => {
    expect(
      buildKimiK25MantleRequestBody({
        conversationId: 'c',
        runId: 'r',
        messages: [message('user', [{ id: 't', type: 'text', text: 'hi' }])],
        tools: [],
      }),
    ).toEqual({
      messages: [{ role: 'user', content: 'hi' }],
      tools: undefined,
      max_tokens: undefined,
      temperature: undefined,
    });
  });
});

describe('kimiK25MantleProtocol', () => {
  const defaults = {
    maxTokens: 999,
    anthropicVersion: 'unused',
    sendTemperature: false,
  };

  it('is named and fills max_tokens from defaults only when the request has none', () => {
    expect(kimiK25MantleProtocol.name).toBe('kimi-k25-mantle');
    expect(
      kimiK25MantleProtocol.buildRequestBody(
        { conversationId: 'c', runId: 'r', messages: [] },
        defaults,
      ),
    ).toMatchObject({ max_tokens: 999 });
    expect(
      kimiK25MantleProtocol.buildRequestBody(
        { conversationId: 'c', runId: 'r', messages: [], maxTokens: 5 },
        defaults,
      ),
    ).toMatchObject({ max_tokens: 5 });
  });

  it('sends temperature only when sendTemperature is enabled', () => {
    const withTemperature = {
      conversationId: 'c',
      runId: 'r',
      messages: [],
      temperature: 0.3,
    };
    expect(
      kimiK25MantleProtocol.buildRequestBody(withTemperature, defaults),
    ).toMatchObject({ temperature: undefined });
    expect(
      kimiK25MantleProtocol.buildRequestBody(withTemperature, {
        ...defaults,
        sendTemperature: true,
      }),
    ).toMatchObject({ temperature: 0.3 });
  });

  it('creates a parser that scans for native tool-call markers', () => {
    const parser = kimiK25MantleProtocol.createParser(2);
    expect(parser).toBeInstanceOf(BedrockMessagesStreamParser);

    const events = [
      ...parser.parse({
        choices: [
          {
            index: 0,
            delta: {
              content:
                '<|tool_calls_section_begin|><|tool_call_begin|>functions.lookup:0<|tool_call_argument_begin|>{"id":1}<|tool_call_end|><|tool_calls_section_end|>',
            },
          },
        ],
      }),
      ...parser.finish(),
    ];

    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'tool-call',
        id: 'tool-2-10000',
        name: 'lookup',
        input: { id: 1 },
      }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'step-finish', index: 2 }),
    );
  });
});
