import { styleOn } from './style-on.function';

export function styleOnPointerEnter(
  element: any,
  style: any,
  elementToStyle?: any,
  onlyIf?: () => boolean
): void {
  styleOn(element, 'mouseenter', style, elementToStyle, onlyIf);
}