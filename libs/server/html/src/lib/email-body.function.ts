import { TAttributes } from './types/attributes.type';
import { div, h1, h2 } from './primitives/elements';
import { fontStyles } from './styles/font-styles.constant';

export function emailBody(
  title: string,
  subtitle: string,
  markup: Array<string | number>,
  logoUrl?: string,
  extraStyles: TAttributes['style'] = {},
) {
  return div([
    div([
      div(
        [
          logoUrl
            ? `<img height="64" width="auto" src="${logoUrl}" />`
            : undefined,
          title ? h1([title]) : undefined,
          subtitle ? h2([subtitle]) : undefined,
        ].filter(Boolean) as string[]
      ),
      div(markup),
    ], {
      style: {
        ...fontStyles,
        ...(extraStyles || {})
      }
    }),
  ]);
}
