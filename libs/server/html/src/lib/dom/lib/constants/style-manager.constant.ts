export interface TStyleManager {
  applyStyle(css: string): string | null;
  getStyles(): string;
}

export class StyleManager {
  private static styleCache = new Map<string, string>();
  private static styles: string[] = [];

  static applyStyle(css: string): string | null {
    if (!css) return null;
    const normalized = css.replace(/\s+/g, ' ').trim();
    if (StyleManager.styleCache.has(normalized)) {
      return StyleManager.styleCache.get(normalized)!;
    }
    const className =
      'sc-' +
      Buffer.from(normalized).toString('base64').slice(0, 8).replace(/[^a-zA-Z0-9]/g, '') +
      '-' +
      Math.random().toString(36).slice(2, 6);
    StyleManager.styleCache.set(normalized, className);
    StyleManager.styles.push(`.${className} { ${normalized} }`);
    return className;
  }

  static getStyles(): string {
    return StyleManager.styles.join('\n');
  }
}

export const styleManager = StyleManager;