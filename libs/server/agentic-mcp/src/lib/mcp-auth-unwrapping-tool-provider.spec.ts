import { McpAuthInfo } from '@onivoro/server-mcp';
import {
  McpAuthUnwrappingOptions,
  executeMcpAuthWrappedTool,
  listMcpAuthWrappedTools,
} from './mcp-auth-unwrapping-tool-provider';
import { McpRegistryAgenticToolProvider } from './mcp-registry-agentic-tool-provider.service';

interface HostAuth {
  kind: 'host';
  mcp?: McpAuthInfo;
  error?: string;
}

const mcpAuth: McpAuthInfo = { token: 't', clientId: 'client', scopes: [] };

const options = (
  overrides: Partial<McpAuthUnwrappingOptions<HostAuth>> = {},
): McpAuthUnwrappingOptions<HostAuth> => ({
  authUnavailableCode: 'auth_unavailable',
  authUnavailableMessage: 'Sign in again.',
  getMcpAuthInfo: (auth) => auth.mcp,
  isAuthContext: (value): value is HostAuth =>
    !!value && (value as HostAuth).kind === 'host',
  ...overrides,
});

function fakeDelegate() {
  return {
    listTools: jest
      .fn()
      .mockResolvedValue([
        { name: 'mcp__mcp__lookup', inputSchema: { type: 'object' } },
      ]),
    executeTool: jest.fn().mockResolvedValue({
      toolCallId: 'call-1',
      name: 'mcp__mcp__lookup',
      result: 'ok',
    }),
  };
}

const asDelegate = (d: ReturnType<typeof fakeDelegate>) =>
  d as unknown as McpRegistryAgenticToolProvider;

const baseContext = { conversationId: 'c', runId: 'r' };

describe(listMcpAuthWrappedTools.name, () => {
  it('returns no tools when the auth context is not recognised', async () => {
    const delegate = fakeDelegate();
    await expect(
      listMcpAuthWrappedTools(
        asDelegate(delegate),
        { ...baseContext, authInfo: { kind: 'other' } },
        options(),
      ),
    ).resolves.toEqual([]);
    expect(delegate.listTools).not.toHaveBeenCalled();
  });

  it('returns no tools when the auth context carries no MCP auth', async () => {
    const delegate = fakeDelegate();
    await expect(
      listMcpAuthWrappedTools(
        asDelegate(delegate),
        { ...baseContext, authInfo: { kind: 'host' } },
        options(),
      ),
    ).resolves.toEqual([]);
  });

  it('delegates with the unwrapped MCP auth info', async () => {
    const delegate = fakeDelegate();
    const tools = await listMcpAuthWrappedTools(
      asDelegate(delegate),
      { ...baseContext, authInfo: { kind: 'host', mcp: mcpAuth } },
      options(),
    );
    expect(tools).toHaveLength(1);
    expect(delegate.listTools).toHaveBeenCalledWith({
      ...baseContext,
      authInfo: mcpAuth,
    });
  });
});

describe(executeMcpAuthWrappedTool.name, () => {
  const call = { id: 'call-1', name: 'mcp__mcp__lookup', input: { id: 1 } };

  it('returns the default auth error when auth is unavailable', async () => {
    const delegate = fakeDelegate();
    await expect(
      executeMcpAuthWrappedTool(
        asDelegate(delegate),
        call,
        { ...baseContext, authInfo: undefined },
        options(),
      ),
    ).resolves.toEqual({
      toolCallId: 'call-1',
      name: 'mcp__mcp__lookup',
      isError: true,
      result: { code: 'auth_unavailable', message: 'Sign in again.' },
      resultText: 'Sign in again.',
    });
    expect(delegate.executeTool).not.toHaveBeenCalled();
  });

  it('uses getError to describe why auth is unavailable', async () => {
    const getError = jest.fn((auth?: HostAuth) => auth?.error);
    const result = await executeMcpAuthWrappedTool(
      asDelegate(fakeDelegate()),
      call,
      { ...baseContext, authInfo: { kind: 'host', error: 'Token expired' } },
      options({ getError }),
    );
    expect(getError).toHaveBeenCalledWith({
      kind: 'host',
      error: 'Token expired',
    });
    expect(result).toMatchObject({
      resultText: 'Token expired',
      result: { code: 'auth_unavailable', message: 'Token expired' },
    });
  });

  it('falls back to the default message when getError returns nothing', async () => {
    const result = await executeMcpAuthWrappedTool(
      asDelegate(fakeDelegate()),
      call,
      { ...baseContext, authInfo: { kind: 'host' } },
      options({ getError: () => undefined }),
    );
    expect(result.resultText).toBe('Sign in again.');
  });

  it('reports an unknown tool', async () => {
    const delegate = fakeDelegate();
    await expect(
      executeMcpAuthWrappedTool(
        asDelegate(delegate),
        { ...call, name: 'nope' },
        { ...baseContext, authInfo: { kind: 'host', mcp: mcpAuth } },
        options(),
      ),
    ).resolves.toEqual({
      toolCallId: 'call-1',
      name: 'nope',
      isError: true,
      result: { code: 'mcp_tool_unknown', message: 'Unknown MCP tool: nope' },
      resultText: 'Unknown MCP tool: nope',
    });
    expect(delegate.executeTool).not.toHaveBeenCalled();
  });

  it('delegates a JSON-normalised call with the unwrapped auth', async () => {
    const delegate = fakeDelegate();
    const when = new Date('2026-01-02T03:04:05.000Z');
    const result = await executeMcpAuthWrappedTool(
      asDelegate(delegate),
      { ...call, input: { id: 1, when, skip: undefined } },
      { ...baseContext, authInfo: { kind: 'host', mcp: mcpAuth } },
      options(),
    );

    expect(result).toMatchObject({ result: 'ok' });
    expect(delegate.executeTool).toHaveBeenCalledWith(
      {
        id: 'call-1',
        name: 'mcp__mcp__lookup',
        input: { id: 1, when: '2026-01-02T03:04:05.000Z' },
      },
      { ...baseContext, authInfo: mcpAuth },
    );
  });

  it('passes an undefined input through untouched', async () => {
    const delegate = fakeDelegate();
    await executeMcpAuthWrappedTool(
      asDelegate(delegate),
      { id: 'call-1', name: 'mcp__mcp__lookup', input: undefined },
      { ...baseContext, authInfo: { kind: 'host', mcp: mcpAuth } },
      options(),
    );
    expect(delegate.executeTool.mock.calls[0][0].input).toBeUndefined();
  });

  it('rejects input that cannot be serialised to JSON', async () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    await expect(
      executeMcpAuthWrappedTool(
        asDelegate(fakeDelegate()),
        { ...call, input: circular },
        { ...baseContext, authInfo: { kind: 'host', mcp: mcpAuth } },
        options(),
      ),
    ).rejects.toThrow('MCP tool input must be JSON serializable.');
  });
});
