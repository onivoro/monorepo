import {
  AgenticToolArgumentStream,
  parseToolInput,
} from './agentic-tool-argument-stream';

const meta = { bedrock: { index: 1 } };

describe('AgenticToolArgumentStream edge cases', () => {
  describe('start', () => {
    it('seeds inputText and metadata and snapshots are copies', () => {
      const stream = new AgenticToolArgumentStream<string>();
      const result = stream.start('a', {
        id: 'call-1',
        name: 'lookup',
        inputText: '{"x":',
        providerMetadata: meta,
      });

      expect(result.tool).toEqual({
        id: 'call-1',
        name: 'lookup',
        inputText: '{"x":',
        providerMetadata: meta,
      });
      expect(result.events).toEqual([
        {
          type: 'tool-input-start',
          id: 'call-1',
          name: 'lookup',
          providerMetadata: meta,
        },
      ]);

      const snapshot = stream.snapshot() as Map<string, unknown>;
      snapshot.delete('a');
      expect(stream.snapshot().has('a')).toBe(true);
    });

    it('re-starting an existing key keeps accumulated text and emits nothing', () => {
      const stream = new AgenticToolArgumentStream<number>();
      stream.start(0, { id: 'c', name: 'n', providerMetadata: meta });
      stream.appendExisting(0, '{"a":1}');

      const restarted = stream.start(0, { id: 'c2', name: 'n2' });
      expect(restarted.events).toEqual([]);
      expect(restarted.tool).toEqual({
        id: 'c2',
        name: 'n2',
        inputText: '{"a":1}',
        providerMetadata: meta,
      });
    });
  });

  describe('appendOrStart', () => {
    it('reports a provider error when the tool identity is unknown', () => {
      const stream = new AgenticToolArgumentStream<number>();
      const result = stream.appendOrStart(0, { text: '{}' });
      expect(result.tool).toBeUndefined();
      expect(result.events).toEqual([
        {
          type: 'provider-error',
          message: 'Tool argument delta is missing its tool identity',
          retryable: false,
        },
      ]);
      expect(stream.snapshot().size).toBe(0);

      expect(
        stream.appendOrStart(0, { id: 'x', text: '' }).events[0].type,
      ).toBe('provider-error');
    });

    it('implicitly starts the tool on the first delta', () => {
      const stream = new AgenticToolArgumentStream<number>();
      const result = stream.appendOrStart(0, {
        id: 'c',
        name: 'n',
        text: '{"a"',
        providerMetadata: meta,
      });
      expect(result.events).toEqual([
        {
          type: 'tool-input-start',
          id: 'c',
          name: 'n',
          providerMetadata: meta,
        },
        {
          type: 'tool-input-delta',
          id: 'c',
          name: 'n',
          text: '{"a"',
          providerMetadata: meta,
        },
      ]);
      expect(result.tool?.inputText).toBe('{"a"');
    });

    it('reuses the stored identity and metadata for later deltas', () => {
      const stream = new AgenticToolArgumentStream<number>();
      stream.appendOrStart(0, {
        id: 'c',
        name: 'n',
        text: '{"a"',
        providerMetadata: meta,
      });
      const result = stream.appendOrStart(0, { text: ':1}' });
      expect(result.events).toEqual([
        {
          type: 'tool-input-delta',
          id: 'c',
          name: 'n',
          text: ':1}',
          providerMetadata: meta,
        },
      ]);
      expect(result.tool?.inputText).toBe('{"a":1}');
    });

    it('emits only the start event for an empty first delta', () => {
      const stream = new AgenticToolArgumentStream<number>();
      const result = stream.appendOrStart(0, { id: 'c', name: 'n', text: '' });
      expect(result.events.map((e) => e.type)).toEqual(['tool-input-start']);
    });

    it('emits nothing for an empty delta on a started tool', () => {
      const stream = new AgenticToolArgumentStream<number>();
      stream.start(0, { id: 'c', name: 'n' });
      expect(stream.appendOrStart(0, { text: '' }).events).toEqual([]);
    });
  });

  describe('appendExisting', () => {
    it('reports a provider error before the start event', () => {
      const stream = new AgenticToolArgumentStream<number>();
      expect(stream.appendExisting(3, '{}').events).toEqual([
        {
          type: 'provider-error',
          message: 'Tool argument delta arrived before its start event',
          retryable: false,
        },
      ]);
    });

    it('ignores empty text', () => {
      const stream = new AgenticToolArgumentStream<number>();
      stream.start(0, { id: 'c', name: 'n' });
      const result = stream.appendExisting(0, '');
      expect(result.events).toEqual([]);
      expect(result.tool?.inputText).toBe('');
    });
  });

  describe('finish / finishAll', () => {
    it('finish on an unknown key is a no-op', () => {
      const stream = new AgenticToolArgumentStream<number>();
      expect(stream.finish(9)).toEqual({ tools: new Map(), events: [] });
    });

    it('finish removes the tool and empty input parses to {}', () => {
      const stream = new AgenticToolArgumentStream<number>();
      stream.start(0, { id: 'c', name: 'n' });
      const result = stream.finish(0);
      expect(result.tools.size).toBe(0);
      expect(result.events[1]).toMatchObject({ type: 'tool-call', input: {} });
    });

    it('finishAll closes every pending tool in insertion order', () => {
      const stream = new AgenticToolArgumentStream<string>();
      stream.start('a', { id: 'c1', name: 'one', inputText: '{"x":1}' });
      stream.start('b', { id: 'c2', name: 'two', inputText: 'not json' });

      const result = stream.finishAll();
      expect(result.tools.size).toBe(0);
      expect(
        result.events.map((e) => [e.type, (e as { id: string }).id]),
      ).toEqual([
        ['tool-input-end', 'c1'],
        ['tool-call', 'c1'],
        ['tool-input-end', 'c2'],
        ['tool-call', 'c2'],
      ]);
      expect((result.events[1] as { input: unknown }).input).toEqual({ x: 1 });
      expect((result.events[3] as { input: unknown }).input).toMatchObject({
        _raw: 'not json',
        _parseError: expect.any(String),
      });
    });
  });
});

describe(parseToolInput.name, () => {
  it('returns {} for blank input', () => {
    expect(parseToolInput('   ')).toEqual({});
  });

  it('parses trimmed JSON', () => {
    expect(parseToolInput(' [1,2] ')).toEqual([1, 2]);
  });

  it('wraps unparsable input with the raw text and error', () => {
    const result = parseToolInput('{"a":') as Record<string, unknown>;
    expect(result['_raw']).toBe('{"a":');
    expect(typeof result['_parseError']).toBe('string');
  });
});
