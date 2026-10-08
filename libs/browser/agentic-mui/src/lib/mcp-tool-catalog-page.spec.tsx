import { act, render, screen, waitFor } from '@testing-library/react';
import {
  McpToolCatalogFetchPage,
  McpToolCatalogPageShell,
} from './mcp-tool-catalog-page';

describe('McpToolCatalogPageShell', () => {
  it('shows the loading label until the html arrives', async () => {
    let resolve: (html: string) => void = () => undefined;
    const loadHtml = jest.fn(() => new Promise<string>((r) => (resolve = r)));

    const { container } = render(
      <McpToolCatalogPageShell loadHtml={loadHtml} loadingLabel="Hold on" />,
    );

    expect(screen.queryByText('Hold on')).not.toBeNull();

    await act(async () => resolve('<p>tools</p>'));

    const iframe = container.querySelector('iframe');
    expect(iframe?.getAttribute('srcdoc')).toBe('<p>tools</p>');
    expect(iframe?.getAttribute('title')).toBe('MCP tool catalog');
    expect(screen.queryByText('Hold on')).toBeNull();
  });

  it('uses the default loading label and a custom iframe title', async () => {
    const { container } = render(
      <McpToolCatalogPageShell
        iframeTitle="Catalog"
        loadHtml={() => Promise.resolve('<b>x</b>')}
      />,
    );

    expect(screen.queryByText('Loading MCP tool catalog...')).not.toBeNull();
    await waitFor(() =>
      expect(container.querySelector('iframe')?.getAttribute('title')).toBe(
        'Catalog',
      ),
    );
  });

  it('shows the error message when loading fails', async () => {
    render(
      <McpToolCatalogPageShell
        loadHtml={() => Promise.reject(new Error('boom'))}
      />,
    );

    await screen.findByText('Unable to load MCP tool catalog');
    expect(screen.queryByText('boom')).not.toBeNull();
  });

  it('stringifies a non-Error rejection', async () => {
    render(
      <McpToolCatalogPageShell loadHtml={() => Promise.reject('plain')} />,
    );

    await screen.findByText('plain');
  });

  it('ignores a result that lands after unmount', async () => {
    let resolve: (html: string) => void = () => undefined;
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    const { unmount } = render(
      <McpToolCatalogPageShell
        loadHtml={() => new Promise<string>((r) => (resolve = r))}
      />,
    );

    unmount();
    await act(async () => resolve('<p>late</p>'));

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('wraps the content in the page shell when given one', () => {
    render(
      <McpToolCatalogPageShell
        loadHtml={() => new Promise<string>(() => undefined)}
        pageShell={(children) => (
          <section aria-label="shell">{children}</section>
        )}
      />,
    );

    expect(screen.getByLabelText('shell').textContent).toContain(
      'Loading MCP tool catalog...',
    );
  });
});

describe('McpToolCatalogFetchPage', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('fetches the endpoint with the given options and renders its value', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ value: '<h1>catalog</h1>' }),
    });
    global.fetch = fetchMock as any;
    const fetchOptions = { credentials: 'include' as const };

    const { container } = render(
      <McpToolCatalogFetchPage
        endpoint="/api/tools"
        errorLabel="Catalog failed"
        fetchOptions={fetchOptions}
      />,
    );

    await waitFor(() =>
      expect(container.querySelector('iframe')?.getAttribute('srcdoc')).toBe(
        '<h1>catalog</h1>',
      ),
    );
    expect(fetchMock).toHaveBeenCalledWith('/api/tools', fetchOptions);
  });

  it('reports a non-ok response with the error label and status', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 503 }) as any;

    render(
      <McpToolCatalogFetchPage
        endpoint="/api/tools"
        errorLabel="Catalog failed"
      />,
    );

    await screen.findByText('Catalog failed: 503');
  });
});
