import { asElementFactory } from './as-element-factory.function';

describe('asElementFactory', () => {
  const renderer = jest.fn(
    (content: Array<string | number>, attributes?: any) =>
      ({ content, attributes }) as any,
  );
  const factory = asElementFactory(renderer);

  beforeEach(() => renderer.mockClear());

  it('renders empty content and no attributes by default', () => {
    factory();

    expect(renderer).toHaveBeenCalledWith([], {
      cssClass: undefined,
      style: undefined,
    });
  });

  it('maps className to cssClass and passes style and other attributes through', () => {
    const style = { color: 'red' };
    factory({ className: 'c', style, id: 'x', 'data-y': 1 } as any);

    expect(renderer).toHaveBeenCalledWith([], {
      cssClass: 'c',
      style,
      id: 'x',
      'data-y': 1,
    });
  });

  it('uses children as content', () => {
    factory({ children: ['a', 'b'] });

    expect(renderer.mock.calls[0][0]).toEqual(['a', 'b']);
  });

  it('prefers $$ over children', () => {
    factory({ children: ['a'], $$: ['b'] } as any);

    expect(renderer.mock.calls[0][0]).toEqual(['b']);
  });

  it('prefers textContent over $$ and children, including falsy values', () => {
    factory({ children: ['a'], $$: ['b'], textContent: 0 } as any);

    expect(renderer.mock.calls[0][0]).toEqual(['0']);
  });

  it('HTML-escapes textContent', () => {
    factory({ textContent: `<b class="x">'&'</b>` });

    expect(renderer.mock.calls[0][0]).toEqual([
      '&lt;b class=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/b&gt;',
    ]);
  });

  it('passes innerHTML through unescaped', () => {
    factory({ innerHTML: '<b>&amp;</b>' });

    expect(renderer.mock.calls[0][0]).toEqual(['<b>&amp;</b>']);
  });

  it('prefers innerHTML over everything else', () => {
    factory({
      children: ['a'],
      textContent: 't',
      innerHTML: '<b>x</b>',
    } as any);

    expect(renderer.mock.calls[0][0]).toEqual(['<b>x</b>']);
  });

  it('ignores empty children arrays', () => {
    factory({ children: [], $$: [] } as any);

    expect(renderer.mock.calls[0][0]).toEqual([]);
  });
});
