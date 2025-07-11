import { _body as body, _h1 as h1, _h2 as h2, _head as head, _header as header, _htm as htm, _main as main, _style as style } from './tags';

export function html(
  title: string,
  subtitle: string,
  markup: Array<string | number>,
  logoUrl?: string
) {
  return htm([
    head([
      style([
        'body {',
        'padding: 64px;',
        `font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";`,
        `font-size: 1rem;`,
        `-webkit-font-smoothing: antialiased;`,
        `-moz-osx-font-smoothing: grayscale;`,
        'color: rgb(34, 30, 31);',
        '}',
        'h1, h2, h3, h4, pre { color: rgb(34, 30, 31) !important; }',
        'td, th { text-align: left; padding: 8px;}',
        'table { border-collapse: collapse; width: 100%;}',
        'tbody { border-width: 1px; border-style: solid; border-left-style: none; border-right-style: none; }',
        '.focal, a { padding: 12px 24px; font-weight: bold; display: block; text-align: center; border-radius: 4px; }',
        '.mw-880 { max-width: 880px !important; margin: auto; }',
        '.mw-440 { max-width: 440px !important; margin: auto; }',
        'pre { padding: 12px 24px; font-weight: bold; display: block; text-align: center; border-radius: 4px; border: solid 1px; }',
        'a { max-width: 240px; }',
        '.bg-gray { background-color: #efefef; }',
        '.drop-shadow, .button { filter: drop-shadow(2px 2px 1px rgba(0, 0, 0, 0.3)); }',
        '.button { text-decoration: none; margin: 32px 0; background-color: rgb(205, 62, 71); color: white !important; }',
      ]),
    ]),
    body([
      header(
        [
          logoUrl
            ? `<img height="64" width="auto" src="${logoUrl}" />`
            : undefined,
          h1([title]),
          h2([subtitle]),
        ].filter(Boolean) as string[]
      ),
      main(markup),
    ]),
  ]);
}
