import { escapeHtmlAttr } from './escape-html-attr.function';

export function formatAttributes(attributes?: Record<string, any>) {
  if (!attributes) {
    return '';
  }

  return Object.entries(attributes)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}="${escapeHtmlAttr(v)}"`)
    .join(' ');
}
