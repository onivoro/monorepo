import { TElementRenderer } from '../../../types/element-renderer.type';
import { TAttributes } from '../../../types/attributes.type';
import { TElementProps } from '../types/element-props.type';
import { escapeHtmlAttr } from '../../../primitives/escape-html-attr.function';

export function asElementFactory(
  renderer: TElementRenderer,
): (props?: TElementProps) => string {
  return (props = {}) => {
    const { style, className, children, textContent, innerHTML, $$, ...attrs } =
      props;
    const attributes: TAttributes = {
      cssClass: className,
      style,
      ...attrs,
    };
    let content: Array<string | number> = [];
    if (children && children.length) content = children;
    if ($$ && $$.length) content = $$;
    if (textContent != null) content = [escapeHtmlAttr(textContent)];
    if (innerHTML != null) content = [innerHTML];
    return renderer(content, attributes);
  };
}
