import { element } from './element.function';
import { selfClosingElement } from './self-closing-element.function';

describe('element', () => {
  it('renders a tag with joined content', () => {
    expect(element('p', ['a', 1, 'b'])).toBe('<p >a1b</p>');
  });

  it('renders the class attribute from cssClass', () => {
    expect(element('div', [], { cssClass: 'box' })).toBe(
      '<div class="box" ></div>',
    );
  });

  it('omits the class attribute when cssClass is empty', () => {
    expect(element('div', [], { cssClass: '' })).toBe('<div ></div>');
  });

  it('escapes the class attribute', () => {
    expect(element('div', [], { cssClass: 'a"><b' })).toBe(
      '<div class="a&quot;&gt;&lt;b" ></div>',
    );
  });

  it('does not escape content', () => {
    expect(element('div', ['<b>x</b>'])).toBe('<div ><b>x</b></div>');
  });

  it('renders escaped attributes and inline style', () => {
    expect(
      element('a', ['link'], {
        href: '/x?a=1&b=2',
        style: { textAlign: 'center' },
      }),
    ).toBe('<a href="/x?a=1&amp;b=2" style="text-align: center;">link</a>');
  });
});

describe('selfClosingElement', () => {
  it('renders a void element without a closing tag', () => {
    expect(selfClosingElement('br')).toBe('<br />');
  });

  it('keeps attributes, class and style', () => {
    expect(
      selfClosingElement('img', {
        cssClass: 'pic',
        src: 'a.png',
        style: { width: '10px' },
      }),
    ).toBe('<img class="pic" src="a.png" style="width: 10px;"/>');
  });
});
