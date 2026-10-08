import { McpToolRegistry } from '@onivoro/server-mcp';
import { McpToolCatalogService } from './mcp-tool-catalog.service';

function setup() {
  const registry = {
    getTools: jest.fn().mockReturnValue([
      {
        metadata: {
          name: 'get-order',
          title: 'Get order',
          annotations: { readOnlyHint: true },
        },
      },
    ]),
    getToolJsonSchemas: jest.fn().mockReturnValue([
      {
        name: 'get-order',
        description: 'Fetch an order',
        jsonSchema: { type: 'object' },
      },
      { name: 'orphan', description: undefined, jsonSchema: {} },
    ]),
  };
  return {
    registry,
    service: new McpToolCatalogService(registry as unknown as McpToolRegistry),
  };
}

describe(McpToolCatalogService.name, () => {
  it('joins json schemas with registry metadata', () => {
    expect(setup().service.listTools()).toEqual([
      {
        annotations: { readOnlyHint: true },
        description: 'Fetch an order',
        jsonSchema: { type: 'object' },
        name: 'get-order',
        title: 'Get order',
      },
      {
        annotations: undefined,
        description: undefined,
        jsonSchema: {},
        name: 'orphan',
        title: undefined,
      },
    ]);
  });

  it('renders the catalog html from the registry', () => {
    const html = setup().service.renderHtml({
      serverUrl: 'https://example.test',
    });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('get-order');
    expect(html).toContain('orphan');
    expect(html).toContain('2 registered tools');
  });
});
