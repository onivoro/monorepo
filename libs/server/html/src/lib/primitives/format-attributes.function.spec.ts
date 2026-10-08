import { formatAttributes } from './format-attributes.function';

describe('formatAttributes', () => {
  it('returns an empty string for no attributes', () => {
    expect(formatAttributes()).toBe('');
    expect(formatAttributes({})).toBe('');
  });

  it('renders space-separated key="value" pairs in insertion order', () => {
    expect(formatAttributes({ id: 'main', 'data-x': 1 })).toBe(
      'id="main" data-x="1"',
    );
  });

  it('escapes attribute values', () => {
    expect(formatAttributes({ title: '"><script>' })).toBe(
      'title="&quot;&gt;&lt;script&gt;"',
    );
  });

  it('omits undefined and null values but keeps other falsy ones', () => {
    expect(
      formatAttributes({ a: undefined, b: null, c: 0, d: false, e: '' }),
    ).toBe('c="0" d="false" e=""');
  });
});
