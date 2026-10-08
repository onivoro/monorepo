import { addNonceToScripts } from './add-nonce-to-scripts';

describe(addNonceToScripts.name, () => {
  it('adds a nonce to bare script tags', () => {
    expect(addNonceToScripts('<script>x()</script>', 'abc')).toBe(
      '<script nonce="abc">x()</script>',
    );
  });

  it('adds a nonce to script tags with attributes', () => {
    expect(
      addNonceToScripts('<script type="module" src="/a.js"></script>', 'abc'),
    ).toBe('<script nonce="abc" type="module" src="/a.js"></script>');
  });

  it('does not duplicate a nonce already present', () => {
    expect(addNonceToScripts('<script nonce="abc">y()</script>', 'abc')).toBe(
      '<script nonce="abc">y()</script>',
    );
  });

  it('handles multiple script tags and leaves other markup alone', () => {
    const html =
      '<div><script>a()</script><script src="b.js"></script><span>c</span></div>';
    expect(addNonceToScripts(html, 'n1')).toBe(
      '<div><script nonce="n1">a()</script><script nonce="n1" src="b.js"></script><span>c</span></div>',
    );
  });

  it('returns html unchanged when there are no scripts', () => {
    expect(addNonceToScripts('<p>hi</p>', 'n')).toBe('<p>hi</p>');
  });
});
