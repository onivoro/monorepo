import { parseBody } from './parse-body.function';

describe('parseBody', () => {
  it('parses the JSON stored under the "{}" key', () => {
    expect(parseBody<{ a: number }>({ '{}': '{"a":1}' })).toEqual({ a: 1 });
  });

  it('throws on invalid JSON', () => {
    expect(() => parseBody({ '{}': 'nope' })).toThrow(SyntaxError);
  });
});
