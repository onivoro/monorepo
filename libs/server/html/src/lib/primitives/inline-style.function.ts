import { CSSProperties } from '../types/attributes.type';

export function inlineStyle(styles: CSSProperties): string {
  const rules = Object.entries(styles)
    .filter(([, v]) => (v != null) && (v != undefined))
    .map(([k, v]) => {
      // convert camelCase property names to kebab-case
      const prop = k.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${prop}: ${v};`;
    })
    .join(' ');
  return `style="${rules}"`;
}
