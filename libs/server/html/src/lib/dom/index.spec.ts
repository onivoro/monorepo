import { $a, $b, $br, $div, $hr, $img, $input, $li, $meta, $ul } from './index';

describe('dom element factories', () => {
  it('renders nested lists', () => {
    expect(
      $ul({
        children: [$li({ textContent: 'one' }), $li({ textContent: 'two' })],
      }),
    ).toBe('<ul ><li >one</li><li >two</li></ul>');
  });

  it('renders anchors with escaped attributes', () => {
    expect($a({ href: '/search?q="x"', textContent: 'go' } as any)).toBe(
      '<a href="/search?q=&quot;x&quot;">go</a>',
    );
  });

  it.each([
    ['br', $br],
    ['hr', $hr],
  ])('renders <%s> as a void element', (tag, factory) => {
    expect(factory()).toBe(`<${tag} />`);
  });

  it('renders void elements with attributes and ignores content', () => {
    expect(
      $img({ src: 'a.png', alt: 'A', textContent: 'ignored' } as any),
    ).toBe('<img src="a.png" alt="A"/>');
    expect($input({ type: 'text', name: 'q' } as any)).toBe(
      '<input type="text" name="q"/>',
    );
    expect($meta({ charset: 'utf-8' } as any)).toBe('<meta charset="utf-8"/>');
  });

  it('escapes textContent', () => {
    expect($li({ textContent: '<script>' })).toBe('<li >&lt;script&gt;</li>');
    expect($li({ textContent: `"><img src=x onerror='alert(1)'>&` })).toBe(
      '<li >&quot;&gt;&lt;img src=x onerror=&#39;alert(1)&#39;&gt;&amp;</li>',
    );
  });

  it('renders innerHTML raw', () => {
    expect($li({ innerHTML: '<b>bold</b>' })).toBe('<li ><b>bold</b></li>');
  });

  it('does not escape children, so nested elements still render', () => {
    expect($li({ children: [$b({ textContent: '<x>' })] })).toBe(
      '<li ><b >&lt;x&gt;</b></li>',
    );
  });

  it('escapes className and style values', () => {
    expect(
      $div({
        className: '"><script>alert(1)</script>',
        style: { fontFamily: '"a" </style>' },
      }),
    ).toBe(
      '<div class="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"  style="font-family: &quot;a&quot; &lt;/style&gt;;"></div>',
    );
  });

  it('escapes attribute values', () => {
    expect($a({ title: `"><img onerror=alert(1)>`, textContent: 'x' })).toBe(
      '<a title="&quot;&gt;&lt;img onerror=alert(1)&gt;">x</a>',
    );
  });

  it('omits undefined and null attributes', () => {
    expect(
      $a({ href: undefined, title: null, id: 'k', textContent: 'x' }),
    ).toBe('<a id="k">x</a>');
    expect($img({ src: 'a.png', alt: undefined })).toBe('<img src="a.png"/>');
  });
});
