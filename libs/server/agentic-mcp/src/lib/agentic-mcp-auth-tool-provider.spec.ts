import {
  AgenticToolDefinition,
  AgenticToolExecutionContext,
} from '@onivoro/isomorphic-agentic';
import { McpAuthInfo } from '@onivoro/server-mcp';
import {
  AgenticMcpAuthContext,
  resolveAgenticMcpAuth,
} from './agentic-mcp-auth';
import { AgenticMcpAuthToolProvider } from './agentic-mcp-auth-tool-provider';
import { McpRegistryAgenticToolProvider } from './mcp-registry-agentic-tool-provider.service';

const verified = (): McpAuthInfo => ({
  token: 'web-token',
  clientId: 'web-client',
  scopes: ['openid'],
  extra: { sub: 'user-1' },
});

const lookup = { name: 'mcp__app__lookup', inputSchema: { type: 'object' } };
const purge = { name: 'mcp__app__purge', inputSchema: { type: 'object' } };

function fakeDelegate() {
  return {
    listTools: jest.fn().mockResolvedValue([lookup, purge]),
    executeTool: jest.fn().mockResolvedValue({
      toolCallId: 'call-1',
      name: 'mcp__app__lookup',
      result: 'ok',
    }),
  };
}

const asDelegate = (d: ReturnType<typeof fakeDelegate>) =>
  d as unknown as McpRegistryAgenticToolProvider;

const baseContext = { conversationId: 'c', runId: 'r' };

async function resolvedContext() {
  return resolveAgenticMcpAuth({
    token: 'web-token',
    verify: async () => verified(),
  });
}

describe(AgenticMcpAuthToolProvider.name, () => {
  it('lists the delegate tools with the resolved MCP auth info', async () => {
    const delegate = fakeDelegate();
    const provider = new AgenticMcpAuthToolProvider(asDelegate(delegate));
    const authInfo = await resolvedContext();

    await expect(
      provider.listTools({ ...baseContext, authInfo }),
    ).resolves.toEqual([lookup, purge]);
    expect(delegate.listTools).toHaveBeenCalledTimes(1);
    expect(delegate.listTools.mock.calls[0][0].authInfo).toBe(
      authInfo.mcpAuthInfo,
    );
  });

  it('lists no tools without an agentic MCP auth context', async () => {
    const delegate = fakeDelegate();
    const provider = new AgenticMcpAuthToolProvider(asDelegate(delegate));

    await expect(
      provider.listTools({ ...baseContext, authInfo: verified() }),
    ).resolves.toEqual([]);
    await expect(provider.listTools(baseContext)).resolves.toEqual([]);
    expect(delegate.listTools).not.toHaveBeenCalled();
  });

  it('returns the resolution error as a tool error', async () => {
    const delegate = fakeDelegate();
    const provider = new AgenticMcpAuthToolProvider(asDelegate(delegate));
    const authInfo = await resolveAgenticMcpAuth({
      token: 'web-token',
      verify: async () => {
        throw new Error('Token expired');
      },
    });

    await expect(
      provider.executeTool(
        { id: 'call-1', name: lookup.name, input: {} },
        { ...baseContext, authInfo },
      ),
    ).resolves.toEqual({
      toolCallId: 'call-1',
      name: lookup.name,
      isError: true,
      result: { code: 'mcp_auth_unavailable', message: 'Token expired' },
      resultText: 'Token expired',
    });
    expect(delegate.executeTool).not.toHaveBeenCalled();
  });

  it('returns an error for an unknown tool', async () => {
    const delegate = fakeDelegate();
    const provider = new AgenticMcpAuthToolProvider(asDelegate(delegate));

    await expect(
      provider.executeTool(
        { id: 'call-1', name: 'mcp__app__missing', input: {} },
        { ...baseContext, authInfo: await resolvedContext() },
      ),
    ).resolves.toMatchObject({
      isError: true,
      result: { code: 'mcp_tool_unknown' },
    });
    expect(delegate.executeTool).not.toHaveBeenCalled();
  });

  it('executes through the delegate with the unwrapped auth info', async () => {
    const delegate = fakeDelegate();
    const provider = new AgenticMcpAuthToolProvider(asDelegate(delegate));
    const authInfo = await resolvedContext();

    await expect(
      provider.executeTool(
        { id: 'call-1', name: lookup.name, input: { q: 'x' } },
        { ...baseContext, authInfo },
      ),
    ).resolves.toEqual({
      toolCallId: 'call-1',
      name: lookup.name,
      result: 'ok',
    });
    expect(delegate.executeTool).toHaveBeenCalledWith(
      { id: 'call-1', name: lookup.name, input: { q: 'x' } },
      { ...baseContext, authInfo: authInfo.mcpAuthInfo },
    );
    expect(delegate.executeTool.mock.calls[0][1].authInfo).toBe(
      authInfo.mcpAuthInfo,
    );
  });

  it('lets a subclass filter the listed tools', async () => {
    type AppAuthContext = AgenticMcpAuthContext & { actionIds: string[] };

    class ActionToolProvider extends AgenticMcpAuthToolProvider {
      override async listTools(
        context: AgenticToolExecutionContext,
      ): Promise<AgenticToolDefinition[]> {
        const { actionIds = [] } = (context.authInfo ?? {}) as AppAuthContext;
        const tools = await super.listTools(context);
        return tools.filter((tool) =>
          actionIds.includes(tool.name.split('__').pop() ?? ''),
        );
      }
    }

    const delegate = fakeDelegate();
    const provider = new ActionToolProvider(asDelegate(delegate));
    const authInfo: AppAuthContext = {
      ...(await resolvedContext()),
      actionIds: ['lookup'],
    };

    await expect(
      provider.listTools({ ...baseContext, authInfo }),
    ).resolves.toEqual([lookup]);
    expect(delegate.listTools.mock.calls[0][0].authInfo).toBe(
      authInfo.mcpAuthInfo,
    );
  });
});
