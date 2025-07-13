import { $div, $h1, $p } from './index';

describe('server-html DOM example', () => {
  it('renders nested div with h1 and p to correct HTML string', () => {
    const html = $div({
      className: 'container',
      children: [
        $h1({ textContent: 'Server-Side Rendering', style: {fontWeight: '700'}}),
        $p({ textContent: 'This markup was generated on the server.' }),
      ],
    });
    expect(html).toMatchInlineSnapshot(
      `"<div class="container" ><h1  style="font-weight: 700;">Server-Side Rendering</h1><p >This markup was generated on the server.</p></div>"`
    );
  });
});