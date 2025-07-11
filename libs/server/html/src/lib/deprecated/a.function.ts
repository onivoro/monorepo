export function a(text: string, href: string, cssClass?: string) {
  const classExp = cssClass ? `class="${cssClass}"` : '';
  return `<a target="_blank" href="${href}" ${classExp}>${text}</a>`;
}
