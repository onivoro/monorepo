import {
  CLAUDE_CONNECTOR_CALLBACK_URL,
  claudeCodeMcpAddCommand,
  codexMcpAddCommand,
  codexMcpLoginCommand,
  codexMcpCallbackPortSetting,
  DEFAULT_CLAUDE_CODE_CALLBACK_PORT,
  mcpClientCallbackUrls,
  McpClientSetupOptions,
  opencodeMcpAuthCommand,
  opencodeMcpConfig,
} from './mcp-client-setup';

const base: McpClientSetupOptions = {
  serverName: 'acme',
  mcpUrl: 'https://acme.example.com/api/mcp',
};
const preRegistered: McpClientSetupOptions = {
  ...base,
  oauthClientId: 'client-123',
};

describe('opencodeMcpConfig', () => {
  it('names the remote server without OAuth settings by default', () => {
    expect(JSON.parse(opencodeMcpConfig(base))).toEqual({
      $schema: 'https://opencode.ai/config.json',
      mcp: {
        acme: {
          type: 'remote',
          url: 'https://acme.example.com/api/mcp',
          enabled: true,
        },
      },
    });
  });

  it('adds the pre-registered client and scope', () => {
    const config = JSON.parse(
      opencodeMcpConfig({ ...preRegistered, oauthScope: 'openid email' }),
    );
    expect(config.mcp.acme.oauth).toEqual({
      clientId: 'client-123',
      scope: 'openid email',
    });
  });

  it('leaves the scope out when none is given', () => {
    expect(JSON.parse(opencodeMcpConfig(preRegistered)).mcp.acme.oauth).toEqual(
      { clientId: 'client-123' },
    );
  });

  it('authenticates by server name', () => {
    expect(opencodeMcpAuthCommand(base)).toBe('opencode mcp auth acme');
  });
});

describe('claudeCodeMcpAddCommand', () => {
  it('adds an HTTP server at user scope', () => {
    expect(claudeCodeMcpAddCommand(base)).toBe(
      'claude mcp add \\\n  --transport http \\\n  --scope user \\\n  acme \\\n  https://acme.example.com/api/mcp',
    );
  });

  it('passes the client ID and the default callback port', () => {
    const command = claudeCodeMcpAddCommand(preRegistered);
    expect(command).toContain('--client-id client-123');
    expect(command).toContain(
      `--callback-port ${DEFAULT_CLAUDE_CODE_CALLBACK_PORT}`,
    );
    expect(command.indexOf('--client-id')).toBeLessThan(
      command.indexOf('acme'),
    );
  });

  it('uses a custom callback port', () => {
    expect(
      claudeCodeMcpAddCommand({
        ...preRegistered,
        claudeCodeCallbackPort: 4000,
      }),
    ).toContain('--callback-port 4000');
  });
});

describe('codex commands', () => {
  it('adds the server by URL, with the client ID when pre-registered', () => {
    expect(codexMcpAddCommand(base)).toBe(
      'codex mcp add acme \\\n  --url https://acme.example.com/api/mcp',
    );
    expect(codexMcpAddCommand(preRegistered)).toContain(
      '--oauth-client-id client-123',
    );
  });

  it('logs in by server name', () => {
    expect(codexMcpLoginCommand(base)).toBe('codex mcp login acme');
  });

  it('pins the callback port only with a client ID and a port', () => {
    expect(codexMcpCallbackPortSetting(preRegistered)).toBeUndefined();
    expect(
      codexMcpCallbackPortSetting({ ...base, codexCallbackPort: 5555 }),
    ).toBe(undefined);
    expect(
      codexMcpCallbackPortSetting({
        ...preRegistered,
        codexCallbackPort: 5555,
      }),
    ).toBe('callback_port = 5555');
  });
});

describe('mcpClientCallbackUrls', () => {
  it('lists the fixed callback URLs for every client by default', () => {
    expect(mcpClientCallbackUrls(preRegistered)).toEqual([
      `http://localhost:${DEFAULT_CLAUDE_CODE_CALLBACK_PORT}/callback`,
      CLAUDE_CONNECTOR_CALLBACK_URL,
    ]);
  });

  it('includes the Codex URL when its port is pinned', () => {
    expect(
      mcpClientCallbackUrls(
        {
          ...preRegistered,
          codexCallbackPort: 5555,
          claudeCodeCallbackPort: 4000,
        },
        ['claude-code', 'codex', 'opencode'],
      ),
    ).toEqual([
      'http://localhost:4000/callback',
      'http://127.0.0.1:5555/callback',
    ]);
  });
});
