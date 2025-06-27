export function toUniqueArray<TElement>(elements: TElement[]): TElement[] {
  return Array.from(new Set(elements));
}
