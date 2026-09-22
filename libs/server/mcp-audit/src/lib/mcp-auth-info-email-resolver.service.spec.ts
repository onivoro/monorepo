import { McpAuthInfoEmailResolver } from './mcp-auth-info-email-resolver.service';

describe(McpAuthInfoEmailResolver.name, () => {
  it('resolves the email from MCP auth info extra claims', () => {
    const resolver = new McpAuthInfoEmailResolver();

    expect(
      resolver.resolveEmail({
        toolName: 'tool',
        params: {},
        metadata: { name: 'tool', description: 'Tool' },
        authInfo: {
          token: 'token',
          clientId: 'client',
          scopes: [],
          extra: { email: 'user@example.com' },
        },
      }),
    ).toBe('user@example.com');
  });

  it('returns undefined when the email claim is unavailable', () => {
    const resolver = new McpAuthInfoEmailResolver();

    expect(
      resolver.resolveEmail({
        toolName: 'tool',
        params: {},
        metadata: { name: 'tool', description: 'Tool' },
      }),
    ).toBeUndefined();
  });
});
