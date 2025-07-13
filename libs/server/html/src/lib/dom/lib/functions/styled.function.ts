import { styleManager } from '../constants/style-manager.constant';

export function styled<T>(
  creator: (props?: any) => string
): (css: TemplateStringsArray, ...values: any[]) => (props?: any) => string {
  return (css, ...values) => (props = {}) => {
    const raw = css.reduce(
      (acc, part, i) => acc + part + (values[i] || ''),
      ''
    ).trim();
    const className = styleManager.applyStyle(raw) || '';
    const propsWithClass = {
      ...props,
      className: [className, props.className].filter(Boolean).join(' '),
    };
    return creator(propsWithClass);
  };
}