import { styleOn } from './style-on.function';

export function styleOnFocus(
  element: any,
  style: any,
  elementToStyle?: any,
  onlyIf?: () => boolean
): void {
  styleOn(element, 'focus', style, elementToStyle, onlyIf);
}