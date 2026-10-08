import { TAttributes } from '../types/attributes.type';
import { escapeHtmlAttr } from './escape-html-attr.function';
import { formatAttributes } from './format-attributes.function';
import { inlineStyle } from './inline-style.function';

export function element(
  tag: string,
  content: Array<string | number>,
  attributes?: TAttributes,
) {
  const { cssClass = '', style = undefined, ...attrs } = attributes || {};
  const classExp = cssClass ? ` class="${escapeHtmlAttr(cssClass)}"` : '';
  const attributesExp = attrs ? ` ${formatAttributes(attrs)}` : '';
  const styleExp = style ? ` ${inlineStyle(style)}` : '';

  return `<${tag}${classExp}${attributesExp}${styleExp}>${content.join?.('')}</${tag}>`;
}
