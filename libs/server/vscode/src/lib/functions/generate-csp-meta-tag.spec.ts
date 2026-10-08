import type * as vscode from 'vscode';
import { generateCspMetaTag } from './generate-csp-meta-tag';

const webview = { cspSource: 'vscode-resource:' } as vscode.Webview;

describe(generateCspMetaTag.name, () => {
  it('builds a default policy with unsafe-inline styles', () => {
    expect(generateCspMetaTag({ webview, nonce: 'N' })).toBe(
      `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; ` +
        `style-src vscode-resource: 'unsafe-inline'; ` +
        `script-src 'nonce-N' 'unsafe-inline'; ` +
        `img-src vscode-resource: https: data:; ` +
        `font-src vscode-resource:;">`,
    );
  });

  it('omits unsafe-inline styles when disabled and appends extra sources', () => {
    const tag = generateCspMetaTag({
      webview,
      nonce: 'N',
      allowUnsafeInlineStyles: false,
      additionalScriptSrc: ['https://s.example'],
      additionalStyleSrc: ['https://st.example'],
      additionalImgSrc: ['blob:'],
      additionalFontSrc: ['https://f.example'],
    });
    expect(tag).toContain(
      "script-src 'nonce-N' 'unsafe-inline' https://s.example;",
    );
    expect(tag).toContain('style-src vscode-resource: https://st.example;');
    expect(tag).toContain('img-src vscode-resource: https: data: blob:;');
    expect(tag).toContain('font-src vscode-resource: https://f.example;');
  });
});
