import * as path from 'path';
import { readFileSync } from 'fs';
import { BaseWebviewProvider } from './base-webview-provider';

jest.mock(
  'vscode',
  () => ({ Uri: { file: (p: string) => ({ fsPath: p, scheme: 'file' }) } }),
  { virtual: true },
);

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn(),
}));

jest.mock('../functions/generate-nonce', () => ({
  generateNonce: () => 'NONCE',
}));

const readFileSyncMock = readFileSync as unknown as jest.Mock;

class TestProvider extends BaseWebviewProvider {
  injected: string | undefined;

  protected override getInjectedScripts(nonce: string) {
    return this.injected?.replace('{n}', nonce);
  }
}

const INDEX_HTML =
  '<html><head><link href="/assets/app.css"></head>' +
  '<body><script type="module" src="/assets/app.js"></script><img src="https://x/y.png"></body></html>';

function fakeWebviewView() {
  let receive: (m: unknown) => void = () => undefined;
  const webview = {
    options: undefined as unknown,
    html: '',
    cspSource: 'csp-src',
    asWebviewUri: jest.fn(
      (uri: { fsPath: string }) => `vscode-webview://${uri.fsPath}`,
    ),
    postMessage: jest.fn().mockResolvedValue(true),
    onDidReceiveMessage: jest.fn((cb: (m: unknown) => void) => {
      receive = cb;
    }),
  };
  return {
    view: { webview } as never,
    webview,
    receive: (m: unknown) => receive(m),
  };
}

describe(BaseWebviewProvider.name, () => {
  const extensionUri = { fsPath: '/ext' } as never;

  beforeEach(() => {
    readFileSyncMock.mockReset().mockReturnValue(INDEX_HTML);
    jest.spyOn(Date, 'now').mockReturnValue(1234);
  });

  afterEach(() => jest.restoreAllMocks());

  it('resolves the view, configures options and renders processed html', () => {
    const provider = new TestProvider(extensionUri, {
      webviewDistPath: 'dist/webview',
    });
    const { view, webview } = fakeWebviewView();

    provider.resolveWebviewView(view, {} as never, {} as never);

    expect(provider.view).toBe(view);
    expect(webview.options).toEqual({
      enableScripts: true,
      localResourceRoots: [extensionUri],
    });
    expect(readFileSyncMock).toHaveBeenCalledWith(
      path.join('/ext', 'dist/webview', 'index.html'),
      'utf8',
    );

    const html = webview.html;
    expect(html).toContain(
      `href="vscode-webview://${path.join('/ext/dist/webview', 'assets/app.css')}?v=1234"`,
    );
    expect(html).toContain(
      `src="vscode-webview://${path.join('/ext/dist/webview', 'assets/app.js')}?v=1234"`,
    );
    expect(html).toContain('src="https://x/y.png"');
    expect(html).toContain(
      '<head>\n<meta http-equiv="Content-Security-Policy"',
    );
    expect(html).toContain("style-src csp-src 'unsafe-inline';");
    expect(html).toContain("script-src 'nonce-NONCE'");
    expect(html).toContain('window.vscodeApi');
    expect(html).toContain('<script nonce="NONCE" type="module"');
    expect(html).not.toMatch(/nonce="NONCE" nonce=/);
  });

  it('honours disabled cache busting and inline styles', () => {
    const provider = new TestProvider(extensionUri, {
      webviewDistPath: 'web',
      enableCacheBusting: false,
      allowUnsafeInlineStyles: false,
    });
    const { view, webview } = fakeWebviewView();

    provider.resolveWebviewView(view, {} as never, {} as never);

    expect(webview.html).not.toContain('?v=');
    expect(webview.html).toContain('style-src csp-src;');
  });

  it('injects subclass scripts after the api bridge', () => {
    const provider = new TestProvider(extensionUri, { webviewDistPath: 'w' });
    provider.injected = '<script nonce="{n}">window.CFG=1</script>';
    const { view, webview } = fakeWebviewView();

    provider.resolveWebviewView(view, {} as never, {} as never);

    const bridgeIdx = webview.html.indexOf('window.vscodeApi');
    const customIdx = webview.html.indexOf('window.CFG=1');
    expect(bridgeIdx).toBeGreaterThan(-1);
    expect(customIdx).toBeGreaterThan(bridgeIdx);
    expect(webview.html).toContain('<script nonce="NONCE">window.CFG=1');
  });

  it('injects nothing extra by default', () => {
    class PlainProvider extends BaseWebviewProvider {}
    const provider = new PlainProvider(extensionUri, { webviewDistPath: 'w' });
    const { view, webview } = fakeWebviewView();

    provider.resolveWebviewView(view, {} as never, {} as never);

    expect(webview.html.match(/<script nonce="NONCE">/g)).toHaveLength(1);
  });

  it('routes webview messages to the registered handler', () => {
    const provider = new TestProvider(extensionUri, { webviewDistPath: 'w' });
    const { view, receive } = fakeWebviewView();
    provider.resolveWebviewView(view, {} as never, {} as never);

    expect(() => receive({ a: 1 })).not.toThrow();

    const handler = jest.fn();
    provider.onMessage(handler);
    receive({ b: 2 });
    expect(handler).toHaveBeenCalledWith({ b: 2 });
  });

  it('postMessage forwards to the webview, or returns undefined before resolve', async () => {
    const provider = new TestProvider(extensionUri, { webviewDistPath: 'w' });
    expect(provider.postMessage({ x: 1 })).toBeUndefined();
    expect(provider.view).toBeUndefined();

    const { view, webview } = fakeWebviewView();
    provider.resolveWebviewView(view, {} as never, {} as never);

    await expect(provider.postMessage({ x: 1 })).resolves.toBe(true);
    expect(webview.postMessage).toHaveBeenCalledWith({ x: 1 });
  });

  it('reload re-renders only once a view exists', () => {
    const provider = new TestProvider(extensionUri, { webviewDistPath: 'w' });
    provider.reload();
    expect(readFileSyncMock).not.toHaveBeenCalled();

    const { view, webview } = fakeWebviewView();
    provider.resolveWebviewView(view, {} as never, {} as never);
    readFileSyncMock.mockReturnValue(
      '<html><head></head><body>v2</body></html>',
    );
    provider.reload();

    expect(readFileSyncMock).toHaveBeenCalledTimes(2);
    expect(webview.html).toContain('v2');
  });

  it('propagates read errors for a missing index.html', () => {
    readFileSyncMock.mockImplementation(() => {
      throw new Error('ENOENT');
    });
    const provider = new TestProvider(extensionUri, { webviewDistPath: 'w' });
    const { view } = fakeWebviewView();
    expect(() =>
      provider.resolveWebviewView(view, {} as never, {} as never),
    ).toThrow('ENOENT');
  });
});
