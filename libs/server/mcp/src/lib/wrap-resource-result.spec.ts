import { wrapResourceResult } from './wrap-resource-result';

describe('wrapResourceResult', () => {
  const uri = 'app://config';

  it('should pass through results that already have a contents array', () => {
    const existing = { contents: [{ uri, text: 'data' }] };
    expect(wrapResourceResult(existing, uri)).toBe(existing);
  });

  it('should wrap a string into a text resource content', () => {
    expect(wrapResourceResult('hello', uri)).toEqual({
      contents: [{ uri, mimeType: 'text/plain', text: 'hello' }],
    });
  });

  it('should use provided mimeType for string results', () => {
    expect(wrapResourceResult('a,b,c', uri, 'text/csv')).toEqual({
      contents: [{ uri, mimeType: 'text/csv', text: 'a,b,c' }],
    });
  });

  it('should wrap an object into a JSON text resource content', () => {
    const obj = { key: 'value' };
    const result = wrapResourceResult(obj, uri);
    expect(result.contents).toHaveLength(1);
    expect(result.contents[0].uri).toBe(uri);
    expect(result.contents[0].mimeType).toBe('application/json');
    expect(JSON.parse(result.contents[0].text!)).toEqual(obj);
  });

  it('should use provided mimeType for object results', () => {
    const result = wrapResourceResult({ x: 1 }, uri, 'application/vnd.custom+json');
    expect(result.contents[0].mimeType).toBe('application/vnd.custom+json');
  });

  it('should wrap null as JSON string', () => {
    const result = wrapResourceResult(null, uri);
    expect(result.contents[0].text).toBe('null');
  });
});
