import { generateVscodeThemeBridgeInjection } from './generate-vscode-theme-bridge-injection';

describe(generateVscodeThemeBridgeInjection.name, () => {
  const html = generateVscodeThemeBridgeInjection('NONCE');

  it('emits two script tags carrying the nonce', () => {
    expect(html.match(/<script nonce="NONCE">/g)).toHaveLength(2);
  });

  it('includes theme detection and change notification', () => {
    expect(html).toContain("'vscode-dark'");
    expect(html).toContain("'vscode-high-contrast'");
    expect(html).toContain('MutationObserver');
    expect(html).toContain("'vscode-theme-change'");
  });

  it('embeds the ivux -> vscode variable mapping as a JSON string', () => {
    const match = html.match(/style\.textContent = (".*");/);
    expect(match).not.toBeNull();
    const css: string = JSON.parse(match![1]);
    expect(css.startsWith('/* VSCode Theme Bridge')).toBe(true);
    expect(css).toContain(
      '--ivux-background: var(--vscode-sideBar-background) !important;',
    );
    expect(css).toContain(
      '--ivux-primary: var(--vscode-button-background) !important;',
    );
    expect(css).toContain('[data-theme="dark"]');
  });
});
