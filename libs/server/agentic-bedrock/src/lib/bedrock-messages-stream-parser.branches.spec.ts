import {
  BedrockMessagesStreamParser,
  extractKimiK25MantleText,
} from './bedrock-messages-stream-parser';

const BEGIN = '<|tool_calls_section_begin|>';
const END = '<|tool_calls_section_end|>';
const CALL = '<|tool_call_begin|>';
const ARGS = '<|tool_call_argument_begin|>';
const CALL_END = '<|tool_call_end|>';

const native = () =>
  new BedrockMessagesStreamParser(0, { nativeToolCallSyntax: true });

const content = (text: string, index = 0, extra: object = {}) => ({
  choices: [{ index, delta: { content: text }, ...extra }],
});

describe(`${BedrockMessagesStreamParser.name} (branches)`, () => {
  describe('Anthropic content blocks', () => {
    it('ignores unknown and non-object chunks', () => {
      const parser = new BedrockMessagesStreamParser();
      expect(parser.parse(null)).toEqual([]);
      expect(parser.parse('nope')).toEqual([]);
      expect(parser.parse([1, 2])).toEqual([]);
      expect(parser.parse({ type: 'message_start' })).toEqual([]);
      expect(
        parser.parse({
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text' },
        }),
      ).toEqual([]);
    });

    it('reports error chunks as non-retryable provider errors', () => {
      const parser = new BedrockMessagesStreamParser();
      const chunk = { type: 'error', error: { message: 'overloaded' } };
      expect(parser.parse(chunk)).toEqual([
        {
          type: 'provider-error',
          message: 'overloaded',
          retryable: false,
          providerMetadata: { bedrock: chunk },
        },
      ]);
      expect(parser.parse({ type: 'error' })).toEqual([
        expect.objectContaining({ message: 'Bedrock stream error' }),
      ]);
    });

    it('streams reasoning from thinking, reasoning and reasoningContent deltas', () => {
      const parser = new BedrockMessagesStreamParser();
      expect(
        parser.parse({
          type: 'content_block_delta',
          index: 0,
          delta: { thinking: 'a' },
        }),
      ).toEqual([
        { type: 'reasoning-start', id: 'reasoning-0' },
        { type: 'reasoning-delta', id: 'reasoning-0', text: 'a' },
      ]);
      expect(
        parser.parse({
          type: 'content_block_delta',
          index: 0,
          delta: { reasoning: 'b' },
        }),
      ).toEqual([{ type: 'reasoning-delta', id: 'reasoning-0', text: 'b' }]);
      expect(
        parser.parse({
          type: 'content_block_delta',
          content_block_index: 0,
          delta: { reasoningContent: { text: 'c' } },
        }),
      ).toEqual([{ type: 'reasoning-delta', id: 'reasoning-0', text: 'c' }]);
      expect(parser.parse({ type: 'content_block_stop', index: 0 })).toEqual([
        { type: 'reasoning-end', id: 'reasoning-0' },
      ]);
    });

    it('starts server_tool_use blocks with a seeded input and fallback identity', () => {
      const parser = new BedrockMessagesStreamParser();
      expect(
        parser.parse({
          type: 'content_block_start',
          contentBlockIndex: 4,
          contentBlock: { type: 'server_tool_use', input: { q: 'x' } },
        }),
      ).toEqual([
        {
          type: 'tool-input-start',
          id: 'tool-4',
          name: 'tool-4',
          providerMetadata: expect.any(Object),
        },
      ]);
      expect(parser.parse({ type: 'content_block_stop', index: 4 })).toEqual([
        expect.objectContaining({ type: 'tool-input-end', id: 'tool-4' }),
        expect.objectContaining({ type: 'tool-call', input: { q: 'x' } }),
      ]);
    });

    it('uses tool_use_id and accepts toolUse / functionCall argument deltas', () => {
      const parser = new BedrockMessagesStreamParser();
      parser.parse({
        type: 'content_block_start',
        index: 1,
        content_block: { type: 'tool_use', tool_use_id: 'tu', name: 'n' },
      });
      expect(
        parser.parse({
          type: 'content_block_delta',
          index: 1,
          delta: { toolUse: { input: '{"a":' } },
        }),
      ).toEqual([
        expect.objectContaining({ type: 'tool-input-delta', id: 'tu' }),
      ]);
      parser.parse({
        type: 'content_block_delta',
        index: 1,
        delta: { functionCall: { arguments: '1}' } },
      });
      expect(parser.parse({ type: 'content_block_stop', index: 1 })).toEqual([
        expect.objectContaining({ type: 'tool-input-end' }),
        expect.objectContaining({
          type: 'tool-call',
          id: 'tu',
          input: { a: 1 },
        }),
      ]);
    });

    it('reports an argument delta that arrives before its block start', () => {
      const parser = new BedrockMessagesStreamParser();
      expect(
        parser.parse({
          type: 'content_block_delta',
          index: 2,
          delta: { partial_json: '{}' },
        }),
      ).toEqual([
        expect.objectContaining({
          type: 'provider-error',
          message: 'Tool argument delta arrived before its start event',
        }),
      ]);
    });

    it.each([
      ['end_turn', 'stop'],
      ['stop_sequence', 'stop'],
      ['max_tokens', 'length'],
      ['tool_use', 'tool-calls'],
      ['content_filter', 'content-filter'],
      ['refusal', 'unknown'],
    ])('normalizes stop_reason %s to %s', (stopReason, reason) => {
      const parser = new BedrockMessagesStreamParser();
      parser.parse({
        type: 'message_delta',
        delta: { stop_reason: stopReason },
      });
      expect(parser.finish()).toContainEqual(
        expect.objectContaining({ type: 'finish', reason }),
      );
    });

    it('reads stopReason and usage nested in the delta', () => {
      const parser = new BedrockMessagesStreamParser(7);
      parser.parse({
        type: 'message_delta',
        delta: {
          stopReason: 'length',
          usage: {
            inputTokens: 1,
            outputTokens: 2,
            cache_read_input_tokens: 3,
            cache_creation_input_tokens: 4,
          },
        },
      });
      expect(parser.finish()).toEqual([
        {
          type: 'step-finish',
          index: 7,
          reason: 'length',
          usage: {
            inputTokens: 1,
            outputTokens: 2,
            totalTokens: 3,
            cacheReadInputTokens: 3,
            cacheWriteInputTokens: 4,
            providerMetadata: expect.any(Object),
          },
        },
        expect.objectContaining({ type: 'finish', reason: 'length' }),
      ]);
    });

    it('reports an unknown reason when message_delta has no stop reason', () => {
      const parser = new BedrockMessagesStreamParser();
      parser.parse({ type: 'message_delta', delta: {} });
      expect(parser.finish()).toContainEqual(
        expect.objectContaining({ type: 'finish', reason: 'unknown' }),
      );
    });

    it('leaves totalTokens undefined when only one side is known', () => {
      const parser = new BedrockMessagesStreamParser();
      parser.parse({ type: 'message_delta', usage: { output_tokens: 9 } });
      expect(parser.finish()).toContainEqual(
        expect.objectContaining({
          type: 'finish',
          usage: expect.objectContaining({
            inputTokens: undefined,
            outputTokens: 9,
            totalTokens: undefined,
          }),
        }),
      );
    });

    it('combines message_start input tokens with cumulative message_delta output tokens', () => {
      const parser = new BedrockMessagesStreamParser();
      parser.parse({
        type: 'message_start',
        message: {
          usage: {
            input_tokens: 25,
            output_tokens: 1,
            cache_read_input_tokens: 5,
          },
        },
      });
      parser.parse({ type: 'message_delta', usage: { output_tokens: 10 } });
      parser.parse({
        type: 'message_delta',
        delta: { stop_reason: 'end_turn' },
        usage: { output_tokens: 15 },
      });
      expect(parser.parse({ type: 'message_stop' })).toContainEqual({
        type: 'finish',
        reason: 'stop',
        usage: {
          inputTokens: 25,
          outputTokens: 15,
          totalTokens: 40,
          cacheReadInputTokens: 5,
          cacheWriteInputTokens: undefined,
          providerMetadata: { bedrock: { output_tokens: 15 } },
        },
      });
    });

    it('keeps message_start usage when message_delta carries none', () => {
      const parser = new BedrockMessagesStreamParser();
      parser.parse({
        type: 'message_start',
        message: { usage: { input_tokens: 7, output_tokens: 1 } },
      });
      parser.parse({
        type: 'message_delta',
        delta: { stop_reason: 'end_turn' },
      });
      expect(parser.finish()).toContainEqual(
        expect.objectContaining({
          type: 'finish',
          usage: expect.objectContaining({
            inputTokens: 7,
            outputTokens: 1,
            totalTokens: 8,
          }),
        }),
      );
    });

    it('finishes on message_stop exactly once, closing open text, reasoning and tools', () => {
      const parser = new BedrockMessagesStreamParser();
      parser.parse({
        type: 'content_block_delta',
        index: 0,
        delta: { text: 'hi', thinking: 'hmm' },
      });
      parser.parse({
        type: 'content_block_start',
        index: 1,
        content_block: { type: 'tool_use', id: 't', name: 'n' },
      });

      expect(parser.parse({ type: 'message_stop' })).toEqual([
        { type: 'text-end', id: 'text-0' },
        { type: 'reasoning-end', id: 'reasoning-0' },
        expect.objectContaining({ type: 'tool-input-end', id: 't' }),
        expect.objectContaining({ type: 'tool-call', id: 't', input: {} }),
        {
          type: 'step-finish',
          index: 0,
          reason: 'stop',
          usage: undefined,
        },
        { type: 'finish', reason: 'stop', usage: undefined },
      ]);
      expect(parser.finish()).toEqual([]);
    });
  });

  describe('OpenAI-compatible chunks', () => {
    it('streams reasoning_content / reasoningContent / reasoning per choice', () => {
      const parser = new BedrockMessagesStreamParser();
      expect(
        parser.parse({
          choices: [
            { delta: { reasoning_content: 'a' } },
            { index: 5, delta: { reasoningContent: 'b' } },
          ],
        }),
      ).toEqual([
        { type: 'reasoning-start', id: 'reasoning-0' },
        { type: 'reasoning-delta', id: 'reasoning-0', text: 'a' },
        { type: 'reasoning-start', id: 'reasoning-5' },
        { type: 'reasoning-delta', id: 'reasoning-5', text: 'b' },
      ]);
      expect(
        parser.parse({ choices: [{ index: 0, delta: { reasoning: 'c' } }] }),
      ).toEqual([{ type: 'reasoning-delta', id: 'reasoning-0', text: 'c' }]);
    });

    it('streams tool calls by index, starting from id/name and appending arguments', () => {
      const parser = new BedrockMessagesStreamParser();
      expect(
        parser.parse({
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: 'call-1',
                    function: { name: 'lookup', arguments: '{"a"' },
                  },
                ],
              },
            },
          ],
        }),
      ).toEqual([
        expect.objectContaining({
          type: 'tool-input-start',
          id: 'call-1',
          name: 'lookup',
        }),
        expect.objectContaining({ type: 'tool-input-delta', text: '{"a"' }),
      ]);
      expect(
        parser.parse({
          choices: [
            {
              index: 0,
              delta: { tool_calls: [{ function: { arguments: ':1}' } }] },
              finish_reason: 'tool_calls',
            },
          ],
        }),
      ).toEqual([
        expect.objectContaining({ type: 'tool-input-delta', text: ':1}' }),
      ]);
      expect(parser.finish()).toEqual([
        expect.objectContaining({ type: 'tool-input-end', id: 'call-1' }),
        expect.objectContaining({
          type: 'tool-call',
          id: 'call-1',
          input: { a: 1 },
        }),
        expect.objectContaining({ type: 'step-finish', reason: 'tool-calls' }),
        expect.objectContaining({ type: 'finish', reason: 'tool-calls' }),
      ]);
    });

    it('fills in a missing tool name from the index', () => {
      const parser = new BedrockMessagesStreamParser();
      expect(
        parser.parse({
          choices: [{ delta: { tool_calls: [{ index: 2, id: 'only-id' }] } }],
        }),
      ).toEqual([
        expect.objectContaining({
          type: 'tool-input-start',
          id: 'only-id',
          name: 'tool-2',
        }),
      ]);
    });

    it('reports an argument delta for an unknown tool with no identity', () => {
      const parser = new BedrockMessagesStreamParser();
      expect(
        parser.parse({
          choices: [
            { delta: { tool_calls: [{ function: { arguments: '{}' } }] } },
          ],
        }),
      ).toEqual([
        expect.objectContaining({
          type: 'provider-error',
          message: 'Tool argument delta is missing its tool identity',
        }),
      ]);
    });

    it.each([
      ['length', 'length'],
      ['content_filter', 'content-filter'],
      ['stop', 'stop'],
    ])('normalizes finish_reason %s to %s', (finishReason, reason) => {
      const parser = new BedrockMessagesStreamParser();
      parser.parse({ choices: [{ delta: {}, finish_reason: finishReason }] });
      expect(parser.finish()).toContainEqual(
        expect.objectContaining({ type: 'finish', reason }),
      );
    });

    it('reads usage from Bedrock invocation metrics', () => {
      const parser = new BedrockMessagesStreamParser();
      parser.parse({
        choices: [{ delta: {} }],
        'amazon-bedrock-invocationMetrics': {
          inputTokenCount: 4,
          outputTokenCount: 6,
        },
      });
      expect(parser.finish()).toContainEqual(
        expect.objectContaining({
          type: 'finish',
          usage: expect.objectContaining({
            inputTokens: 4,
            outputTokens: 6,
            totalTokens: 10,
          }),
        }),
      );

      const camel = new BedrockMessagesStreamParser();
      camel.parse({
        choices: [{ delta: {} }],
        amazonBedrockInvocationMetrics: { totalTokens: 11 },
      });
      expect(camel.finish()).toContainEqual(
        expect.objectContaining({
          usage: expect.objectContaining({ totalTokens: 11 }),
        }),
      );
    });

    it('reads usage from a final chunk with empty choices', () => {
      const parser = new BedrockMessagesStreamParser();
      parser.parse(content('hi', 0, { finish_reason: 'stop' }));
      expect(
        parser.parse({
          choices: [],
          usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 },
        }),
      ).toEqual([]);
      expect(parser.finish()).toContainEqual(
        expect.objectContaining({
          type: 'finish',
          reason: 'stop',
          usage: expect.objectContaining({
            inputTokens: 12,
            outputTokens: 3,
            totalTokens: 15,
          }),
        }),
      );
    });

    it('keeps earlier usage when later chunks carry none', () => {
      const parser = new BedrockMessagesStreamParser();
      parser.parse({
        ...content('a'),
        usage: { prompt_tokens: 4, completion_tokens: 1 },
      });
      parser.parse(content('b'));
      parser.parse(content('', 0, { finish_reason: 'stop' }));
      expect(parser.finish()).toContainEqual(
        expect.objectContaining({
          type: 'finish',
          usage: expect.objectContaining({
            inputTokens: 4,
            outputTokens: 1,
            totalTokens: 5,
          }),
        }),
      );
    });

    it('merges partial usage reported across chunks', () => {
      const parser = new BedrockMessagesStreamParser();
      parser.parse({ ...content('a'), usage: { prompt_tokens: 9 } });
      parser.parse({ choices: [], usage: { completion_tokens: 6 } });
      expect(parser.finish()).toContainEqual(
        expect.objectContaining({
          type: 'finish',
          usage: expect.objectContaining({
            inputTokens: 9,
            outputTokens: 6,
            totalTokens: 15,
          }),
        }),
      );
    });

    it('passes text straight through without native tool-call scanning', () => {
      const parser = new BedrockMessagesStreamParser();
      expect(parser.parse(content(`x${BEGIN}`))).toEqual([
        { type: 'text-start', id: 'text-0' },
        { type: 'text-delta', id: 'text-0', text: `x${BEGIN}` },
      ]);
    });
  });

  describe('native tool-call syntax', () => {
    it('emits text before and after a tool section and marks tool-calls', () => {
      const parser = native();
      const events = parser.parse(
        content(
          `before ${BEGIN}${CALL}function.lookup${ARGS} {"a":1} ${CALL_END}${END} after`,
        ),
      );
      expect(events).toEqual([
        { type: 'text-start', id: 'text-0' },
        { type: 'text-delta', id: 'text-0', text: 'before ' },
        expect.objectContaining({ type: 'tool-input-start', name: 'lookup' }),
        expect.objectContaining({ type: 'tool-input-delta', text: '{"a":1}' }),
        expect.objectContaining({ type: 'tool-input-end' }),
        expect.objectContaining({ type: 'tool-call', input: { a: 1 } }),
        { type: 'text-delta', id: 'text-0', text: ' after' },
      ]);
      expect(parser.finish()).toContainEqual(
        expect.objectContaining({ type: 'finish', reason: 'tool-calls' }),
      );
    });

    it('parses several calls in one section and numbers them sequentially', () => {
      const parser = native();
      const events = parser.parse(
        content(
          `${BEGIN}${CALL}functions.a:0${ARGS}{}${CALL_END}${CALL}b${ARGS}{}${CALL_END}${END}`,
        ),
      );
      expect(
        events.filter((e) => e.type === 'tool-call').map((e) => e.id),
      ).toEqual(['tool-0-10000', 'tool-0-10001']);
    });

    it('emits a section with no parseable calls as text', () => {
      const parser = native();
      const section = `${BEGIN}garbage${END}`;
      expect(parser.parse(content(section))).toEqual([
        { type: 'text-start', id: 'text-0' },
        { type: 'text-delta', id: 'text-0', text: section },
      ]);
    });

    it.each([
      ['no argument marker', `${CALL}name${CALL_END}`],
      ['no call end marker', `${CALL}name${ARGS}{}`],
      ['an empty name', `${CALL}  ${ARGS}{}${CALL_END}`],
    ])('skips a call with %s', (_label, call) => {
      const parser = native();
      const events = parser.parse(content(`${BEGIN}${call}${END}`));
      expect(events.some((e) => e.type === 'tool-call')).toBe(false);
    });

    it('holds an unterminated section and flushes it as text on finish', () => {
      const parser = native();
      const partial = `${BEGIN}${CALL}lookup`;
      expect(parser.parse(content(`hi ${partial}`))).toEqual([
        { type: 'text-start', id: 'text-0' },
        { type: 'text-delta', id: 'text-0', text: 'hi ' },
      ]);
      expect(parser.finish()).toEqual([
        { type: 'text-delta', id: 'text-0', text: partial },
        { type: 'text-end', id: 'text-0' },
        expect.objectContaining({ type: 'step-finish' }),
        expect.objectContaining({ type: 'finish', reason: 'stop' }),
      ]);
    });

    it('holds a possible marker prefix and flushes it on finish', () => {
      const parser = native();
      expect(parser.parse(content('<|tool'))).toEqual([]);
      expect(parser.finish().slice(0, 3)).toEqual([
        { type: 'text-start', id: 'text-0' },
        { type: 'text-delta', id: 'text-0', text: '<|tool' },
        { type: 'text-end', id: 'text-0' },
      ]);
    });

    it('flushes a held prefix when text switches to another block id', () => {
      const parser = native();
      parser.parse(content('a<'));
      expect(parser.parse(content('b', 1))).toEqual([
        { type: 'text-delta', id: 'text-0', text: '<' },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', text: 'b' },
      ]);
    });

    it('scans Anthropic text deltas too', () => {
      const parser = native();
      const events = parser.parse({
        type: 'content_block_delta',
        index: 0,
        delta: {
          text: `${BEGIN}${CALL}x${ARGS}{}${CALL_END}${END}`,
        },
      });
      expect(events).toContainEqual(
        expect.objectContaining({ type: 'tool-call', name: 'x' }),
      );
    });
  });
});

describe(extractKimiK25MantleText.name, () => {
  it('reads string content from the first choice message', () => {
    expect(
      extractKimiK25MantleText({
        choices: [{ message: { content: '  hello  ' } }],
      }),
    ).toBe('hello');
  });

  it('reads top-level string content', () => {
    expect(extractKimiK25MantleText({ content: ' top ' })).toBe('top');
  });

  it('joins array content text', () => {
    expect(
      extractKimiK25MantleText({
        content: [{ text: 'a' }, { image: 'x' }, { text: 'b ' }],
      }),
    ).toBe('ab');
  });

  it('falls back to output.message.content', () => {
    expect(
      extractKimiK25MantleText({
        output: { message: { content: [{ text: 'x' }, { text: 'y' }] } },
      }),
    ).toBe('xy');
  });

  it('returns an empty string for unrecognised bodies', () => {
    expect(extractKimiK25MantleText(undefined)).toBe('');
    expect(extractKimiK25MantleText({})).toBe('');
  });
});
