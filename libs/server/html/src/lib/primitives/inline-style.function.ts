export function inlineStyle(styles: Record<string, string>) {
  const rules = Object.entries(styles)
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ');
  return `style="${rules}"`;
}
