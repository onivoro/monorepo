import {
  DEFAULT_AGENTIC_MCP_CONFIG,
  agenticLlmAdapterConfig,
} from './agentic-mcp-config';

describe(agenticLlmAdapterConfig.name, () => {
  it('uses the agentic alias key', () => {
    expect(agenticLlmAdapterConfig().aliasKey).toBe('agentic');
  });

  it('prefixes sanitized names with the default namespace', () => {
    const config = agenticLlmAdapterConfig();
    expect(DEFAULT_AGENTIC_MCP_CONFIG).toEqual({
      namespace: 'mcp',
      exposeNamespace: true,
    });
    expect(config.sanitizeName?.('list.orders v2')).toBe(
      'mcp__mcp__list_orders_v2',
    );
  });

  it('sanitizes a custom namespace too', () => {
    expect(
      agenticLlmAdapterConfig({ namespace: 'my app' }).sanitizeName?.('get-x'),
    ).toBe('mcp__my_app__get-x');
  });

  it('only sanitizes when the namespace is not exposed', () => {
    expect(
      agenticLlmAdapterConfig({ exposeNamespace: false }).sanitizeName?.('a/b'),
    ).toBe('a_b');
  });

  it('formats tools into agentic definitions tagged with the namespace', () => {
    expect(
      agenticLlmAdapterConfig({ namespace: 'ns' }).formatTool(
        'mcp__ns__x',
        'does x',
        { type: 'object' },
      ),
    ).toEqual({
      name: 'mcp__ns__x',
      description: 'does x',
      inputSchema: { type: 'object' },
      providerMetadata: { mcp: { namespace: 'ns' } },
    });
  });
});
