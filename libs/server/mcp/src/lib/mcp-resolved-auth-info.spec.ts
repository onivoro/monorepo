import type { McpAuthInfo } from './mcp-auth-info';
import type { McpCanActivate } from './mcp-can-activate';
import type { McpToolContext } from './mcp-tool-context';
import { McpToolRegistry } from './mcp-tool-registry';
import {
  isMcpAuthInfoResolved,
  markMcpAuthInfoResolved,
} from './mcp-resolved-auth-info';
import { wireRegistryToServer } from './wire-registry-to-server';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn(),
  ResourceTemplate: jest.fn(),
}));

jest.mock('@modelcontextprotocol/sdk/types.js', () => ({
  SubscribeRequestSchema: { method: 'resources/subscribe' },
  UnsubscribeRequestSchema: { method: 'resources/unsubscribe' },
}));

const authInfo = (): McpAuthInfo => ({
  token: 'web-token',
  clientId: 'web-client',
  scopes: ['read'],
  extra: { email: 'a@example.com' },
});

describe('markMcpAuthInfoResolved', () => {
  it('marks the object it is given and returns it', () => {
    const info = authInfo();
    expect(markMcpAuthInfoResolved(info)).toBe(info);
    expect(isMcpAuthInfoResolved(info)).toBe(true);
  });

  it('does not mark copies, look-alikes or undefined', () => {
    const info = markMcpAuthInfoResolved(authInfo());
    expect(isMcpAuthInfoResolved({ ...info })).toBe(false);
    expect(isMcpAuthInfoResolved(JSON.parse(JSON.stringify(info)))).toBe(false);
    expect(isMcpAuthInfoResolved(authInfo())).toBe(false);
    expect(isMcpAuthInfoResolved(undefined)).toBe(false);
  });
});

describe('McpToolRegistry with resolved auth info', () => {
  let registry: McpToolRegistry;
  let resolveAuth: jest.Mock;
  let handler: jest.Mock;

  beforeEach(() => {
    registry = new McpToolRegistry();
    resolveAuth = jest.fn().mockImplementation(async (info) => ({
      ...info,
      clientId: 'resolved',
    }));
    registry.setAuthStrategy({ resolveAuth });
    handler = jest.fn().mockResolvedValue('ok');
  });

  it('skips the auth strategy for marked auth info', async () => {
    registry.registerTool({ name: 'tool', description: 'd' }, handler);
    const info = markMcpAuthInfoResolved(authInfo());

    await registry.executeToolRaw('tool', {}, info);

    expect(resolveAuth).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ authInfo: info }),
    );
  });

  it('runs the auth strategy for unmarked auth info and copies of marked auth info', async () => {
    registry.registerTool({ name: 'tool', description: 'd' }, handler);
    const marked = markMcpAuthInfoResolved(authInfo());

    await registry.executeToolRaw('tool', {}, authInfo());
    await registry.executeToolRaw('tool', {}, { ...marked });

    expect(resolveAuth).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenLastCalledWith(
      {},
      expect.objectContaining({
        authInfo: expect.objectContaining({ clientId: 'resolved' }),
      }),
    );
  });

  it('still runs guards for marked auth info', async () => {
    class DenyGuard implements McpCanActivate {
      canActivate = jest.fn((context: McpToolContext) => {
        expect(context.authInfo?.clientId).toBe('web-client');
        return false;
      });
    }
    const guard = new DenyGuard();
    registry.setGuardResolver(() => guard);
    registry.registerTool({ name: 'tool', description: 'd' }, handler, [
      { guardClass: DenyGuard },
    ]);

    await expect(
      registry.executeToolRaw('tool', {}, markMcpAuthInfoResolved(authInfo())),
    ).rejects.toThrow();

    expect(guard.canActivate).toHaveBeenCalled();
    expect(resolveAuth).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('wireRegistryToServer with resolved auth info', () => {
  it('never trusts transport auth info as resolved, even when marked', async () => {
    const registry = new McpToolRegistry();
    const resolveAuth = jest.fn().mockImplementation(async (info) => info);
    registry.setAuthStrategy({ resolveAuth });
    registry.registerTool(
      { name: 'tool', description: 'd' },
      jest.fn().mockResolvedValue('ok'),
    );
    const registerTool = jest.fn();
    wireRegistryToServer(registry, {
      registerTool,
      registerResource: jest.fn(),
      registerPrompt: jest.fn(),
      sendLoggingMessage: jest.fn(),
      server: {
        setRequestHandler: jest.fn(),
        sendResourceUpdated: jest.fn(),
        notification: jest.fn(),
      },
    } as any);

    const transportAuthInfo = markMcpAuthInfoResolved(authInfo());
    await registerTool.mock.calls[0][2]({}, { authInfo: transportAuthInfo });

    expect(resolveAuth).toHaveBeenCalledWith(transportAuthInfo);
    expect(resolveAuth.mock.calls[0][0]).not.toBe(transportAuthInfo);
  });
});
