import {
  McpToolCatalogEntry,
  McpToolCatalogRenderConfig,
  renderMcpToolCatalogHtml,
} from './mcp-tool-catalog.view';

const tools: McpToolCatalogEntry[] = [
  { name: 'zeta-thing', description: 'Last alphabetically' },
  {
    name: 'get-order',
    title: 'Get order',
    description: 'Fetch <one> order',
    jsonSchema: { type: 'object', properties: { id: { type: 'string' } } },
    annotations: { readOnlyHint: true },
  },
  { name: 'search-orders', description: 'Search' },
  { name: 'order-create-draft', annotations: {} },
  { name: 'list-items' },
];

/** Positions of the given strings in the html, to assert ordering. */
const order = (html: string, needles: string[]) =>
  needles.map((needle) => html.indexOf(needle));

describe(renderMcpToolCatalogHtml.name, () => {
  const html = renderMcpToolCatalogHtml(tools, {
    serverUrl: 'https://api.example.test',
  });

  it('renders a full document with the default title and eyebrow', () => {
    expect(html.startsWith('<!doctype html><html')).toBe(true);
    expect(html).toContain('<title >MCP Tool Catalog</title>');
    expect(html).toContain('Generated from McpToolRegistry');
    expect(html).toContain('5 registered tools');
  });

  it('generates a default opencode config pointing at /api/mcp', () => {
    expect(html).toContain('https://api.example.test/api/mcp');
    expect(html).toContain('mcp-server');
    expect(html).toContain('opencode mcp auth mcp-server');
  });

  it('groups tools by verb in the default order', () => {
    const positions = order(html, [
      '>Search<',
      '>Get<',
      '>List<',
      '>Create<',
      '>Other<',
    ]);
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(html).not.toContain('>Update<');
    expect(html).not.toContain('>Delete<');
  });

  it('escapes descriptions and shows titles, annotations and schemas', () => {
    expect(html).toContain('Fetch &lt;one&gt; order');
    expect(html).not.toContain('Fetch <one> order');
    expect(html).toContain('Get order');
    expect(html).toContain('Annotations: ');
    expect(html).toContain('readOnlyHint');
    expect(html).toContain('No description provided.');
    expect(html).toContain('View schema');
  });

  it('omits the annotations block when annotations are empty', () => {
    const only = renderMcpToolCatalogHtml([{ name: 'x', annotations: {} }], {
      serverUrl: 'https://s',
    });
    expect(only).not.toContain('Annotations: ');
    expect(only).toContain('1 registered tools');
  });

  it('honours custom title, eyebrow, endpoint, server name and auth command', () => {
    const custom = renderMcpToolCatalogHtml([], {
      serverUrl: 'https://ignored',
      title: 'My Tools',
      eyebrow: 'Internal',
      mcpUrl: 'https://mcp.example.test/rpc',
      serverName: 'acme',
      authCommand: 'acme login',
    });
    expect(custom).toContain('<title >My Tools</title>');
    expect(custom).toContain('Internal');
    expect(custom).toContain('https://mcp.example.test/rpc');
    expect(custom).not.toContain('https://ignored');
    expect(custom).toContain('acme');
    expect(custom).toContain('acme login');
    expect(custom).toContain('0 registered tools');
  });

  it('uses a supplied configJson instead of the generated snippet', () => {
    const custom = renderMcpToolCatalogHtml([], {
      serverUrl: 'https://s',
      configJson: 'CUSTOM-CONFIG',
    });
    expect(custom).toContain('CUSTOM-CONFIG');
    expect(custom).not.toContain('https://s/api/mcp');
  });

  it('uses a custom group resolver and order, appending unordered groups alphabetically', () => {
    const custom = renderMcpToolCatalogHtml(tools, {
      serverUrl: 'https://s',
      resolveGroupLabel: (name) =>
        name.includes('order')
          ? 'Orders'
          : name.startsWith('z')
            ? 'Zed'
            : 'Misc',
      groupOrder: ['Orders', 'Absent'],
    });
    const positions = order(custom, ['>Orders<', '>Misc<', '>Zed<']);
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(custom).not.toContain('>Absent<');
  });

  describe('escaping host config values', () => {
    const xss = '<script>alert(1)</script>';
    const breakout = '"><img src=x onerror=alert(1)>';
    const escapedXss = '&lt;script&gt;alert(1)&lt;/script&gt;';
    const escapedBreakout = '&quot;&gt;&lt;img src=x onerror=alert(1)&gt;';

    const render = (config: Partial<McpToolCatalogRenderConfig>) =>
      renderMcpToolCatalogHtml([{ name: 'list-x' }], {
        serverUrl: 'https://s',
        ...config,
      });

    it.each([
      ['title', { title: xss }, escapedXss],
      ['eyebrow', { eyebrow: xss }, escapedXss],
      ['authCommand', { authCommand: breakout }, escapedBreakout],
      ['configJson', { configJson: xss }, escapedXss],
      ['group label', { resolveGroupLabel: () => breakout }, escapedBreakout],
    ])('escapes %s exactly once', (_, config, expected) => {
      const out = render(config);
      expect(out).toContain(expected);
      expect(out).not.toContain(xss);
      expect(out).not.toContain('<img');
      expect(out).not.toContain('&amp;lt;');
      expect(out).not.toContain('&amp;quot;');
    });

    it('escapes serverUrl and serverName inside the generated JSON once', () => {
      const out = render({
        serverUrl: `https://s/${breakout}`,
        serverName: xss,
      });
      expect(out).not.toContain('<img');
      expect(out).not.toContain(xss);
      expect(out).toContain(`&quot;${escapedXss}&quot;: {`);
      expect(out).toContain(
        `&quot;url&quot;: &quot;https://s/\\&quot;&gt;&lt;img src=x onerror=alert(1)&gt;/api/mcp&quot;`,
      );
    });

    it('renders the default JSON snippet so it decodes back to the original JSON', () => {
      const out = render({});
      const pre = out.match(/<pre >([\s\S]*?)<\/pre>/)![1];
      const decoded = pre
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
      expect(JSON.parse(decoded)).toEqual({
        $schema: 'https://opencode.ai/config.json',
        mcp: {
          'mcp-server': {
            type: 'remote',
            url: 'https://s/api/mcp',
            enabled: true,
          },
        },
      });
    });

    it('escapes tool fields exactly once', () => {
      const out = renderMcpToolCatalogHtml(
        [
          {
            name: xss,
            title: breakout,
            description: 'a & b',
            jsonSchema: { description: xss },
            annotations: { hint: breakout },
          },
        ],
        { serverUrl: 'https://s' },
      );
      expect(out).not.toContain(xss);
      expect(out).not.toContain('<img');
      expect(out).toContain('a &amp; b');
      expect(out).not.toContain('&amp;amp;');
      expect(out).not.toContain('&amp;lt;');
    });
  });
});
