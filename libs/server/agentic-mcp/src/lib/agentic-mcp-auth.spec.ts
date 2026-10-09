import { Injectable, Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  isMcpAuthInfoResolved,
  McpAuthInfo,
  McpTool,
  McpToolContext,
  McpToolRegistry,
} from '@onivoro/server-mcp';
import { z } from 'zod';
import {
  AGENTIC_MCP_AUTH_KIND,
  agenticMcpAuthUnwrappingOptions,
  isAgenticMcpAuthContext,
  resolveAgenticMcpAuth,
} from './agentic-mcp-auth';
import { AgenticMcpModule } from './agentic-mcp.module';
import { executeMcpAuthWrappedTool } from './mcp-auth-unwrapping-tool-provider';
import { McpRegistryAgenticToolProvider } from './mcp-registry-agentic-tool-provider.service';

const verified = (): McpAuthInfo => ({
  token: 'web-token',
  clientId: 'web-client',
  scopes: ['openid'],
  extra: { sub: 'user-1' },
});

describe('resolveAgenticMcpAuth', () => {
  it('verifies, enriches, checks and marks the auth info', async () => {
    const verify = jest.fn().mockResolvedValue(verified());
    const enrich = jest.fn(async (info: McpAuthInfo) => ({
      ...info,
      extra: { ...info.extra, email: 'a@example.com' },
    }));
    const check = jest.fn().mockReturnValue(undefined);

    const context = await resolveAgenticMcpAuth({
      token: 'web-token',
      verify,
      enrich,
      check,
    });

    expect(verify).toHaveBeenCalledWith('web-token');
    expect(check).toHaveBeenCalledWith(
      expect.objectContaining({
        extra: { sub: 'user-1', email: 'a@example.com' },
      }),
    );
    expect(context).toEqual({
      kind: AGENTIC_MCP_AUTH_KIND,
      mcpAuthInfo: expect.objectContaining({
        extra: { sub: 'user-1', email: 'a@example.com' },
      }),
    });
    expect(isMcpAuthInfoResolved(context.mcpAuthInfo)).toBe(true);
  });

  it('marks the verified auth info when there is nothing to enrich', async () => {
    const info = verified();
    const context = await resolveAgenticMcpAuth({
      token: 't',
      verify: async () => info,
    });

    expect(context.mcpAuthInfo).toBe(info);
    expect(isMcpAuthInfoResolved(info)).toBe(true);
  });

  it('reports a missing token without verifying', async () => {
    const verify = jest.fn();

    await expect(
      resolveAgenticMcpAuth({ token: undefined, verify }),
    ).resolves.toEqual({
      kind: AGENTIC_MCP_AUTH_KIND,
      error: 'Missing MCP access token',
    });
    await expect(
      resolveAgenticMcpAuth({
        token: '',
        verify,
        missingTokenMessage: 'No token',
      }),
    ).resolves.toEqual({ kind: AGENTIC_MCP_AUTH_KIND, error: 'No token' });
    expect(verify).not.toHaveBeenCalled();
  });

  it('reports verification failures', async () => {
    await expect(
      resolveAgenticMcpAuth({
        token: 't',
        verify: async () => {
          throw new Error('jwt expired');
        },
      }),
    ).resolves.toEqual({ kind: AGENTIC_MCP_AUTH_KIND, error: 'jwt expired' });
    await expect(
      resolveAgenticMcpAuth({
        token: 't',
        verify: async () => {
          throw 'not an error';
        },
        invalidTokenMessage: 'Bad token',
      }),
    ).resolves.toEqual({ kind: AGENTIC_MCP_AUTH_KIND, error: 'Bad token' });
    await expect(
      resolveAgenticMcpAuth({
        token: 't',
        verify: async () => {
          throw new Error('');
        },
      }),
    ).resolves.toEqual({
      kind: AGENTIC_MCP_AUTH_KIND,
      error: 'Invalid MCP access token',
    });
  });

  describe('when enrich or check throws', () => {
    let loggerError: jest.SpyInstance;

    beforeEach(() => {
      loggerError = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
    });

    afterEach(() => {
      loggerError.mockRestore();
    });

    it('logs an enrich failure and returns a generic message', async () => {
      const info = verified();
      const context = await resolveAgenticMcpAuth({
        token: 't',
        verify: async () => info,
        enrich: async () => {
          throw new Error('ECONNREFUSED db:5432');
        },
      });

      expect(context).toEqual({
        kind: AGENTIC_MCP_AUTH_KIND,
        error: 'MCP authorization is unavailable.',
      });
      expect(context.error).not.toContain('ECONNREFUSED');
      expect(context.mcpAuthInfo).toBeUndefined();
      expect(isMcpAuthInfoResolved(info)).toBe(false);
      expect(loggerError).toHaveBeenCalled();
    });

    it('logs a check failure and returns unavailableMessage', async () => {
      const context = await resolveAgenticMcpAuth({
        token: 't',
        verify: async () => verified(),
        check: () => {
          throw new Error('ECONNREFUSED db:5432');
        },
        unavailableMessage: 'Try again later',
      });

      expect(context).toEqual({
        kind: AGENTIC_MCP_AUTH_KIND,
        error: 'Try again later',
      });
      expect(context.mcpAuthInfo).toBeUndefined();
      expect(loggerError).toHaveBeenCalled();
    });
  });

  it('refuses when the check returns a reason, without marking', async () => {
    const info = verified();
    const context = await resolveAgenticMcpAuth({
      token: 't',
      verify: async () => info,
      check: async () => 'Token does not match the signed-in user',
    });

    expect(context).toEqual({
      kind: AGENTIC_MCP_AUTH_KIND,
      error: 'Token does not match the signed-in user',
    });
    expect(isMcpAuthInfoResolved(info)).toBe(false);
  });
});

describe('isAgenticMcpAuthContext', () => {
  it('recognises contexts by kind', () => {
    expect(isAgenticMcpAuthContext({ kind: AGENTIC_MCP_AUTH_KIND })).toBe(true);
    expect(isAgenticMcpAuthContext({ kind: 'other' })).toBe(false);
    expect(isAgenticMcpAuthContext(undefined)).toBe(false);
    expect(isAgenticMcpAuthContext('agentic-mcp-auth')).toBe(false);
  });
});

@Injectable()
class WhoAmITools {
  @McpTool({
    name: 'whoami',
    description: 'Who is calling',
    schema: z.object({}),
  })
  async whoami(_params: unknown, context: McpToolContext) {
    return `${context.authInfo?.clientId}:${context.authInfo?.extra?.['email']}`;
  }
}

describe('agentic MCP auth end to end', () => {
  let moduleRef: TestingModule;
  let provider: McpRegistryAgenticToolProvider;
  let resolveAuth: jest.Mock;
  const runContext = { conversationId: 'c', runId: 'r' };
  const call = { id: 'call-1', name: 'mcp__app__whoami', input: {} };

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    moduleRef = await Test.createTestingModule({
      imports: [AgenticMcpModule.configure({ namespace: 'app' })],
      providers: [WhoAmITools],
    }).compile();
    await moduleRef.init();

    // The MCP route's strategy, which rejects the web app's token.
    resolveAuth = jest.fn(async () => {
      throw new Error('unexpected client_id "web-client"');
    });
    moduleRef.get(McpToolRegistry).setAuthStrategy({ resolveAuth });
    provider = moduleRef.get(McpRegistryAgenticToolProvider);
  });

  afterEach(async () => {
    await moduleRef.close();
    jest.restoreAllMocks();
  });

  it('runs tools with resolved auth without re-running the auth strategy', async () => {
    const authContext = await resolveAgenticMcpAuth({
      token: 'web-token',
      verify: async () => verified(),
      enrich: async (info) => ({
        ...info,
        extra: { ...info.extra, email: 'a@example.com' },
      }),
    });

    const result = await executeMcpAuthWrappedTool(
      provider,
      call,
      { ...runContext, authInfo: authContext },
      agenticMcpAuthUnwrappingOptions,
    );

    expect(result).toEqual(
      expect.objectContaining({ result: 'web-client:a@example.com' }),
    );
    expect(result.isError).toBeUndefined();
    expect(resolveAuth).not.toHaveBeenCalled();
  });

  it('runs the auth strategy for auth info that was not resolved', async () => {
    const result = await executeMcpAuthWrappedTool(
      provider,
      call,
      {
        ...runContext,
        authInfo: { kind: AGENTIC_MCP_AUTH_KIND, mcpAuthInfo: verified() },
      },
      agenticMcpAuthUnwrappingOptions,
    );

    expect(result.isError).toBe(true);
    expect(resolveAuth).toHaveBeenCalled();
  });

  it('returns the resolution error as a tool error', async () => {
    const authContext = await resolveAgenticMcpAuth({
      token: undefined,
      verify: async () => verified(),
    });

    await expect(
      executeMcpAuthWrappedTool(
        provider,
        call,
        { ...runContext, authInfo: authContext },
        agenticMcpAuthUnwrappingOptions,
      ),
    ).resolves.toEqual({
      toolCallId: 'call-1',
      name: 'mcp__app__whoami',
      isError: true,
      result: {
        code: 'mcp_auth_unavailable',
        message: 'Missing MCP access token',
      },
      resultText: 'Missing MCP access token',
    });
  });
});
