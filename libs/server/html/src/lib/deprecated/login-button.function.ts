import { anchor } from '../primitives/elements';
import { buttonStyles } from '../styles/button-styles.constant';

export function loginButton(text: string, href: string, extraStyles?: Record<string, string>) {
  return anchor([text], {
    href,
    style: {
      ...buttonStyles,
      ...(extraStyles || {})
    }
  });
}
