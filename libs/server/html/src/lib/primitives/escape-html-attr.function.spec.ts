import { escapeHtmlAttr } from './escape-html-attr.function';

describe('escapeHtmlAttr', () => {
  it('escapes the characters that can break out of an attribute', () => {
    expect(escapeHtmlAttr(`<a href="x" title='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    );
  });

  it('escapes ampersands first so existing entities are not double-decoded', () => {
    expect(escapeHtmlAttr('&lt;')).toBe('&amp;lt;');
  });

  it('leaves safe text alone', () => {
    expect(escapeHtmlAttr('plain text 123')).toBe('plain text 123');
  });

  it('stringifies non-string input', () => {
    expect(escapeHtmlAttr(42 as any)).toBe('42');
    expect(escapeHtmlAttr(true as any)).toBe('true');
  });
});
