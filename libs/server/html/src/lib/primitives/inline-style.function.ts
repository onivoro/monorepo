import { CSSProperties } from '../types/attributes.type';
import { escapeHtmlAttr } from './escape-html-attr.function';

export function inlineStyle(styles: CSSProperties): string {
  const rules = Object.entries(styles)
    .filter(([, v]) => v != null && v != undefined)
    .map(([k, v]) => {
      // convert camelCase property names to kebab-case
      const prop = k.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${prop}: ${v};`;
    })
    .join(' ');
  return `style="${escapeHtmlAttr(rules)}"`;
}
