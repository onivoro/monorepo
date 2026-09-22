import {
  AgenticMessage,
  AgenticModelRequest,
} from '@onivoro/isomorphic-agentic';
import {
  anthropicMessagesProtocol,
  buildAnthropicMessagesRequestBody,
} from './anthropic-messages-protocol';
import { AgenticBedrockRequestDefaults } from './agentic-bedrock-protocol';

const defaults: AgenticBedrockRequestDefaults = {
  maxTokens: 64_000,
  anthropicVersion: 'bedrock-2023-05-31',
  sendTemperature: false,
};

const now = '2026-01-01T00:00:00.000Z';

const message = (
  role: AgenticMessage['role'],
  parts: AgenticMessage['parts'],
): AgenticMessage => ({
  id: `${role}-${parts.map((p) => p.id).join('-')}`,
  conversationId: 'c1',
  role,
  status: 'complete',
  parts,
  createdAt: now,
  updatedAt: now,
});

const text = (id: string, value: string) =>
  ({
    id,
    type: 'text',
    text: value,
    status: 'complete',
    createdAt: now,
    updatedAt: now,
  }) as AgenticMessage['parts'][number];

const toolCall = (id: string, name: string, input: unknown) =>
  ({
    id,
    type: 'tool-call',
    toolCallId: id,
    name,
    input,
    status: 'complete',
    createdAt: now,
    updatedAt: now,
  }) as AgenticMessage['parts'][number];

const toolResult = (
  id: string,
  name: string,
  result: unknown,
  isError = false,
) =>
  ({
    id: `r-${id}`,
    type: 'tool-result',
    toolCallId: id,
    name,
    result,
    resultText: typeof result === 'string' ? result : JSON.stringify(result),
    isError,
    status: isError ? 'error' : 'complete',
    createdAt: now,
    updatedAt: now,
  }) as AgenticMessage['parts'][number];

const request = (messages: AgenticMessage[]): AgenticModelRequest => ({
  conversationId: 'c1',
  runId: 'r1',
  messages,
});

describe('buildAnthropicMessagesRequestBody', () => {
  it('maps a plain exchange', () => {
    const body = buildAnthropicMessagesRequestBody(
      request([
        message('user', [text('p1', 'hello')]),
        message('assistant', [text('p2', 'hi')]),
      ]),
      defaults,
    );

    expect(body.anthropic_version).toBe('bedrock-2023-05-31');
    expect(body.max_tokens).toBe(64_000);
    expect(body.messages).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'hello' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'hi' }] },
    ]);
  });

  it('lifts system and summary messages into the top-level system field', () => {
    const body = buildAnthropicMessagesRequestBody(
      {
        ...request([
          message('summary', [text('p0', 'earlier: the user asked about X')]),
          message('user', [text('p1', 'and now?')]),
        ]),
        system: 'be terse',
      },
      defaults,
    );

    expect(body.system).toBe('be terse\n\nearlier: the user asked about X');
    expect(body.messages.map((m) => m.role)).toEqual(['user']);
  });

  it('emits assistant tool calls as tool_use blocks', () => {
    const body = buildAnthropicMessagesRequestBody(
      request([
        message('user', [text('p1', 'go')]),
        message('assistant', [
          text('p2', 'working'),
          toolCall('t1', 'lookup', { q: 'x' }),
        ]),
      ]),
      defaults,
    );

    expect(body.messages[1]).toEqual({
      role: 'assistant',
      content: [
        { type: 'text', text: 'working' },
        { type: 'tool_use', id: 't1', name: 'lookup', input: { q: 'x' } },
      ],
    });
  });

  // the API expects tool results on a user message, not on a message of role
  // 'tool' -- the shape the run loop persists
  it('turns tool messages into tool_result blocks on a user message', () => {
    const body = buildAnthropicMessagesRequestBody(
      request([
        message('user', [text('p1', 'go')]),
        message('assistant', [toolCall('t1', 'lookup', {})]),
        message('tool', [toolResult('t1', 'lookup', 'found it')]),
      ]),
      defaults,
    );

    expect(body.messages[2]).toEqual({
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 't1', content: 'found it' },
      ],
    });
  });

  // splitting parallel results across separate user messages trains the model
  // to stop making parallel tool calls
  it('merges consecutive tool results into a single user message', () => {
    const body = buildAnthropicMessagesRequestBody(
      request([
        message('user', [text('p1', 'go')]),
        message('assistant', [
          toolCall('t1', 'a', {}),
          toolCall('t2', 'b', {}),
        ]),
        message('tool', [toolResult('t1', 'a', 'one')]),
        message('tool', [toolResult('t2', 'b', 'two')]),
      ]),
      defaults,
    );

    expect(body.messages).toHaveLength(3);
    expect(body.messages[2].content).toEqual([
      { type: 'tool_result', tool_use_id: 't1', content: 'one' },
      { type: 'tool_result', tool_use_id: 't2', content: 'two' },
    ]);
  });

  it('marks failed tool results with is_error', () => {
    const body = buildAnthropicMessagesRequestBody(
      request([
        message('user', [text('p1', 'go')]),
        message('assistant', [toolCall('t1', 'a', {})]),
        message('tool', [toolResult('t1', 'a', 'boom', true)]),
      ]),
      defaults,
    );

    expect(body.messages[2].content[0]).toMatchObject({ is_error: true });
  });

  it('drops a leading assistant turn so the first message is from the user', () => {
    const body = buildAnthropicMessagesRequestBody(
      request([
        message('assistant', [text('p0', 'orphaned by compaction')]),
        message('user', [text('p1', 'hello')]),
      ]),
      defaults,
    );

    expect(body.messages[0].role).toBe('user');
  });

  it('maps tool definitions to input_schema', () => {
    const body = buildAnthropicMessagesRequestBody(
      {
        ...request([message('user', [text('p1', 'go')])]),
        tools: [
          {
            name: 'lookup',
            description: 'look something up',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      },
      defaults,
    );

    expect(body.tools).toEqual([
      {
        name: 'lookup',
        description: 'look something up',
        input_schema: { type: 'object', properties: {} },
      },
    ]);
  });

  // current frontier models reject sampling parameters with a 400 rather than
  // ignoring them, so carrying one through by default would break every call
  it('omits temperature unless explicitly enabled', () => {
    const withTemperature = {
      ...request([message('user', [text('p1', 'go')])]),
      temperature: 0.3,
    };

    expect(
      buildAnthropicMessagesRequestBody(withTemperature, defaults).temperature,
    ).toBeUndefined();

    expect(
      buildAnthropicMessagesRequestBody(withTemperature, {
        ...defaults,
        sendTemperature: true,
      }).temperature,
    ).toBe(0.3);
  });

  it('omits thinking and effort unless configured', () => {
    const plain = buildAnthropicMessagesRequestBody(
      request([message('user', [text('p1', 'go')])]),
      defaults,
    );
    expect(plain.thinking).toBeUndefined();
    expect(plain.output_config).toBeUndefined();

    const configured = buildAnthropicMessagesRequestBody(
      request([message('user', [text('p1', 'go')])]),
      { ...defaults, thinking: { type: 'adaptive' }, effort: 'high' },
    );
    expect(configured.thinking).toEqual({ type: 'adaptive' });
    expect(configured.output_config).toEqual({ effort: 'high' });
  });

  it('prefers the request max_tokens over the default', () => {
    const body = buildAnthropicMessagesRequestBody(
      { ...request([message('user', [text('p1', 'go')])]), maxTokens: 1024 },
      defaults,
    );
    expect(body.max_tokens).toBe(1024);
  });
});

describe('anthropicMessagesProtocol', () => {
  it('parses a text and tool_use stream without inline marker scanning', () => {
    const parser = anthropicMessagesProtocol.createParser(0);

    const events = [
      ...parser.parse({
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text' },
      }),
      ...parser.parse({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'hel' },
      }),
      ...parser.parse({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'lo' },
      }),
      ...parser.parse({ type: 'content_block_stop', index: 0 }),
      ...parser.parse({
        type: 'content_block_start',
        index: 1,
        content_block: { type: 'tool_use', id: 't1', name: 'lookup' },
      }),
      ...parser.parse({
        type: 'content_block_delta',
        index: 1,
        delta: { type: 'input_json_delta', partial_json: '{"q":' },
      }),
      ...parser.parse({
        type: 'content_block_delta',
        index: 1,
        delta: { type: 'input_json_delta', partial_json: '"x"}' },
      }),
      ...parser.parse({ type: 'content_block_stop', index: 1 }),
      ...parser.parse({
        type: 'message_delta',
        delta: { stop_reason: 'tool_use' },
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
      ...parser.parse({ type: 'message_stop' }),
    ];

    // text arrives immediately, not held back waiting for a possible marker
    expect(events.filter((e) => e.type === 'text-delta')).toEqual([
      { type: 'text-delta', id: 'text-0', text: 'hel' },
      { type: 'text-delta', id: 'text-0', text: 'lo' },
    ]);

    const call = events.find((e) => e.type === 'tool-call');
    expect(call).toMatchObject({ name: 'lookup', input: { q: 'x' } });

    const finish = events.find((e) => e.type === 'finish');
    expect(finish).toMatchObject({ reason: 'tool-calls' });
  });
});
