import { generateVscodeApiBridgeScript } from './generate-vscode-api-bridge-script';

describe(generateVscodeApiBridgeScript.name, () => {
  it('emits a nonce-tagged script that exposes window.vscodeApi', () => {
    const script = generateVscodeApiBridgeScript('xyz');
    expect(script).toContain('<script nonce="xyz">');
    expect(script).toContain('acquireVsCodeApi()');
    expect(script).toContain('window.vscodeApi');
    expect(script).toContain("new CustomEvent('vscode-message'");
    expect(script.trim().endsWith('</script>')).toBe(true);
  });
});
