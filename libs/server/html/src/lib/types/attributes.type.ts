import { CSSProperties } from '../dom/lib/types/css-properties.type';
export { CSSProperties };

export type TAttributes =
  Record<string, any> & {
    /** CSS class names */
    cssClass?: string;
    /** Inline style properties */
    style?: CSSProperties;
  };
