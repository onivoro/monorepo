import { CSSProperties } from '../types/css-properties.type';

export interface TElementProps {
  style?: CSSProperties;
  className?: string;
  children?: Array<string | number>;
  textContent?: string;
  innerHTML?: string;
  [key: string]: any;
}