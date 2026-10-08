import { inlineStyle } from './inline-style.function';

describe('inlineStyle', () => {
  it('converts camelCase properties to kebab-case declarations', () => {
    expect(inlineStyle({ fontWeight: '700', backgroundColor: 'red' })).toBe(
      'style="font-weight: 700; background-color: red;"',
    );
  });

  it('omits null and undefined values but keeps falsy ones like 0', () => {
    expect(
      inlineStyle({ margin: 0, padding: undefined, color: null } as any),
    ).toBe('style="margin: 0;"');
  });

  it('renders an empty style attribute for an empty object', () => {
    expect(inlineStyle({})).toBe('style=""');
  });

  it('escapes values so they cannot break out of the attribute', () => {
    expect(inlineStyle({ fontFamily: `"x"><script>'` })).toBe(
      'style="font-family: &quot;x&quot;&gt;&lt;script&gt;&#39;;"',
    );
  });
});
