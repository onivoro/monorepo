export type McpClientSetupTarget =
  | 'opencode'
  | 'claude-code'
  | 'claude-desktop'
  | 'codex';

export const MCP_CLIENT_SETUP_TARGETS: McpClientSetupTarget[] = [
  'opencode',
  'claude-code',
  'claude-desktop',
  'codex',
];

/**
 * Claude Code's OAuth callback port when a pre-registered client is used.
 * Claude Code otherwise picks a random port, which no pre-registered redirect
 * URI can match, so `http://localhost:<port>/callback` must be allowed on the
 * client.
 */
export const DEFAULT_CLAUDE_CODE_CALLBACK_PORT = 3118;

/** Where Claude Desktop (and claude.ai) sends the OAuth callback. */
export const CLAUDE_CONNECTOR_CALLBACK_URL =
  'https://claude.ai/api/mcp/auth_callback';

export interface McpClientSetupOptions {
  /** Key the server is registered under in each client. */
  serverName: string;
  /** Absolute public MCP endpoint. */
  mcpUrl: string;
  /**
   * Pre-registered OAuth client ID, for authorization servers without dynamic
   * client registration (e.g. Amazon Cognito). Omit when the server supports
   * dynamic client registration.
   */
  oauthClientId?: string;
  /** OAuth scope opencode requests, e.g. `openid email`. */
  oauthScope?: string;
  /** Defaults to `DEFAULT_CLAUDE_CODE_CALLBACK_PORT` when `oauthClientId` is set. */
  claudeCodeCallbackPort?: number;
  /** Fixed Codex callback port. Codex uses an ephemeral port when unset. */
  codexCallbackPort?: number;
}

/** opencode config (`~/.config/opencode/opencode.json`) for this server. */
export function opencodeMcpConfig(options: McpClientSetupOptions): string {
  const oauth = options.oauthClientId
    ? {
        oauth: {
          clientId: options.oauthClientId,
          ...(options.oauthScope && { scope: options.oauthScope }),
        },
      }
    : {};

  return JSON.stringify(
    {
      $schema: 'https://opencode.ai/config.json',
      mcp: {
        [options.serverName]: {
          type: 'remote',
          url: options.mcpUrl,
          enabled: true,
          ...oauth,
        },
      },
    },
    null,
    2,
  );
}

export function opencodeMcpAuthCommand(options: McpClientSetupOptions): string {
  return `opencode mcp auth ${options.serverName}`;
}

/** `claude mcp add` for Claude Code; authenticate afterwards with `/mcp`. */
export function claudeCodeMcpAddCommand(
  options: McpClientSetupOptions,
): string {
  return [
    'claude mcp add',
    '--transport http',
    '--scope user',
    ...(options.oauthClientId
      ? [
          `--client-id ${options.oauthClientId}`,
          `--callback-port ${claudeCodeCallbackPort(options)}`,
        ]
      : []),
    options.serverName,
    options.mcpUrl,
  ].join(' \\\n  ');
}

export function codexMcpAddCommand(options: McpClientSetupOptions): string {
  return [
    `codex mcp add ${options.serverName}`,
    `--url ${options.mcpUrl}`,
    ...(options.oauthClientId
      ? [`--oauth-client-id ${options.oauthClientId}`]
      : []),
  ].join(' \\\n  ');
}

/**
 * The line that pins the Codex OAuth callback port, or `undefined` when no
 * fixed port is wanted. It belongs in the `[mcp_servers.<serverName>.oauth]`
 * table that `codex mcp add --oauth-client-id` writes to `~/.codex/config.toml`;
 * adding a second copy of that table would be invalid TOML.
 */
export function codexMcpCallbackPortSetting(
  options: McpClientSetupOptions,
): string | undefined {
  if (!options.oauthClientId || options.codexCallbackPort === undefined) {
    return undefined;
  }

  return `callback_port = ${options.codexCallbackPort}`;
}

export function codexMcpLoginCommand(options: McpClientSetupOptions): string {
  return `codex mcp login ${options.serverName}`;
}

/**
 * The OAuth redirect URIs a pre-registered client must allow for the given
 * targets. opencode and Codex print theirs; the ones listed here are fixed.
 */
export function mcpClientCallbackUrls(
  options: McpClientSetupOptions,
  targets: McpClientSetupTarget[] = MCP_CLIENT_SETUP_TARGETS,
): string[] {
  return targets.flatMap((target) => {
    switch (target) {
      case 'claude-code':
        return [`http://localhost:${claudeCodeCallbackPort(options)}/callback`];
      case 'claude-desktop':
        return [CLAUDE_CONNECTOR_CALLBACK_URL];
      case 'codex':
        return options.codexCallbackPort === undefined
          ? []
          : [`http://127.0.0.1:${options.codexCallbackPort}/callback`];
      default:
        return [];
    }
  });
}

function claudeCodeCallbackPort(options: McpClientSetupOptions): number {
  return options.claudeCodeCallbackPort ?? DEFAULT_CLAUDE_CODE_CALLBACK_PORT;
}
