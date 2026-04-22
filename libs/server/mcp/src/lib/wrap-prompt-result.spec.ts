import { wrapPromptResult } from './wrap-prompt-result';

describe('wrapPromptResult', () => {
  it('should pass through results that already have a messages array', () => {
    const existing = {
      messages: [{ role: 'user' as const, content: { type: 'text' as const, text: 'hi' } }],
    };
    expect(wrapPromptResult(existing)).toBe(existing);
  });

  it('should preserve description on pass-through', () => {
    const existing = {
      description: 'A summary prompt',
      messages: [{ role: 'user' as const, content: { type: 'text' as const, text: 'hi' } }],
    };
    expect(wrapPromptResult(existing)).toBe(existing);
    expect((wrapPromptResult(existing) as any).description).toBe('A summary prompt');
  });

  it('should wrap a string into a user message', () => {
    expect(wrapPromptResult('Generate a summary')).toEqual({
      messages: [
        { role: 'user', content: { type: 'text', text: 'Generate a summary' } },
      ],
    });
  });

  it('should wrap an object into a user message with JSON text', () => {
    const obj = { topic: 'testing' };
    const result = wrapPromptResult(obj);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe('user');
    expect((result.messages[0].content as any).type).toBe('text');
    expect(JSON.parse((result.messages[0].content as any).text)).toEqual(obj);
  });

  it('should wrap null as JSON string', () => {
    const result = wrapPromptResult(null);
    expect((result.messages[0].content as any).text).toBe('null');
  });
});
