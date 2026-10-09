import {
  $a,
  $body,
  $code,
  $details,
  $div,
  $h1,
  $h2,
  $h3,
  $head,
  $html,
  $li,
  $main,
  $meta,
  $p,
  $pre,
  $span,
  $strong,
  $style,
  $summary,
  $title,
  $ul,
} from '@onivoro/server-html';
import {
  claudeCodeMcpAddCommand,
  codexMcpAddCommand,
  codexMcpLoginCommand,
  codexMcpCallbackPortSetting,
  MCP_CLIENT_SETUP_TARGETS,
  McpClientSetupOptions,
  McpClientSetupTarget,
  opencodeMcpAuthCommand,
  opencodeMcpConfig,
} from './mcp-client-setup';

export type McpToolCatalogEntry = {
  annotations?: Record<string, unknown>;
  description?: string;
  jsonSchema?: Record<string, unknown>;
  name: string;
  title?: string;
};

export interface McpToolCatalogRenderConfig {
  /** Replaces the generated opencode auth command. */
  authCommand?: string;
  /** Claude Code OAuth callback port; see `McpClientSetupOptions`. */
  claudeCodeCallbackPort?: number;
  /** Client setup sections to render, in order. Defaults to all of them. */
  clients?: McpClientSetupTarget[];
  /** Codex OAuth callback port; see `McpClientSetupOptions`. */
  codexCallbackPort?: number;
  /** Replaces the generated opencode config snippet entirely. */
  configJson?: string;
  eyebrow?: string;
  groupOrder?: string[];
  /** Absolute MCP endpoint. Defaults to `${serverUrl}/api/mcp`. */
  mcpUrl?: string;
  resolveGroupLabel?: (name: string) => string;
  /**
   * Pre-registered OAuth client ID that every client authenticates with, for
   * authorization servers without dynamic client registration (e.g. Cognito).
   */
  oauthClientId?: string;
  /** OAuth scope opencode requests with `oauthClientId`. */
  oauthScope?: string;
  /** Key the server is registered under in each client. */
  serverName?: string;
  serverUrl: string;
  title?: string;
}

type McpToolCatalogGroup = {
  label: string;
  tools: McpToolCatalogEntry[];
};

const defaultTitle = 'MCP Tool Catalog';
// Verb-shaped, so the ordering says nothing about any particular domain. A
// host with real groups passes its own `groupOrder`.
const defaultGroupOrder = [
  'Search',
  'Get',
  'List',
  'Create',
  'Update',
  'Delete',
  'Other',
];

export function renderMcpToolCatalogHtml(
  tools: McpToolCatalogEntry[],
  config: McpToolCatalogRenderConfig,
) {
  const sortedTools = [...tools].sort((a, b) => a.name.localeCompare(b.name));
  const title = config.title ?? defaultTitle;
  const groups = groupTools(sortedTools, config);

  return (
    '<!doctype html>' +
    $html({
      lang: 'en',
      children: [
        $head({
          children: [
            $meta({ charset: 'utf-8' }),
            $meta({
              name: 'viewport',
              content: 'width=device-width, initial-scale=1',
            }),
            $title({ textContent: title }),
            $style({ innerHTML: styles }),
          ],
        }),
        $body({
          children: [
            $main({
              children: [
                $div({
                  className: 'hero',
                  children: [
                    $span({
                      className: 'eyebrow',
                      textContent:
                        config.eyebrow ?? 'Generated from McpToolRegistry',
                    }),
                    $h1({ textContent: title }),
                    $p({
                      className: 'lede',
                      textContent: `${sortedTools.length} registered tools with names, descriptions, and input schemas.`,
                    }),
                    ...renderInstallationGuide(config),
                  ],
                }),
                ...groups.map((group) => renderGroup(group)),
              ],
            }),
          ],
        }),
      ],
    })
  );
}

function renderInstallationGuide(config: McpToolCatalogRenderConfig) {
  const options = clientSetupOptions(config);
  const renderers: Record<
    McpClientSetupTarget,
    (options: McpClientSetupOptions) => string[]
  > = {
    opencode: (options) => renderOpencodeSetup(options, config),
    'claude-code': renderClaudeCodeSetup,
    'claude-desktop': renderClaudeDesktopSetup,
    codex: renderCodexSetup,
  };

  return [
    $h2({ textContent: 'Installation Guide' }),
    ...(config.clients ?? MCP_CLIENT_SETUP_TARGETS).flatMap((target) =>
      renderers[target](options),
    ),
  ];
}

function clientSetupOptions(
  config: McpToolCatalogRenderConfig,
): McpClientSetupOptions {
  return {
    serverName: config.serverName ?? 'mcp-server',
    mcpUrl: config.mcpUrl ?? `${config.serverUrl}/api/mcp`,
    oauthClientId: config.oauthClientId,
    oauthScope: config.oauthScope,
    claudeCodeCallbackPort: config.claudeCodeCallbackPort,
    codexCallbackPort: config.codexCallbackPort,
  };
}

/**
 * The generated opencode config is deliberately minimal: it names the server
 * and, with `oauthClientId`, its OAuth client. Anything about which model to
 * run, or which cloud credentials to use, belongs to whoever is connecting --
 * so a host that wants a richer snippet supplies its own through `configJson`.
 */
function renderOpencodeSetup(
  options: McpClientSetupOptions,
  config: McpToolCatalogRenderConfig,
) {
  return [
    $h3({ textContent: 'opencode' }),
    $ul({
      children: [
        $li({
          children: [
            $span({ textContent: 'Install opencode ' }),
            $a({
              textContent: 'opencode.ai',
              href: 'https://opencode.ai/',
              target: '_blank',
            }),
          ],
        }),
        $li({
          children: [
            $p({
              textContent:
                'Create an opencode file at ~/.config/opencode/opencode.json',
            }),
            $pre({
              textContent: config.configJson ?? opencodeMcpConfig(options),
            }),
          ],
        }),
        $li({
          children: [
            $p({ textContent: 'Register this MCP server' }),
            $pre({
              textContent:
                config.authCommand ?? opencodeMcpAuthCommand(options),
            }),
          ],
        }),
      ],
    }),
  ];
}

function renderClaudeCodeSetup(options: McpClientSetupOptions) {
  return [
    $h3({ textContent: 'Claude Code' }),
    $ul({
      children: [
        $li({
          children: [
            $span({ textContent: 'Install Claude Code ' }),
            $a({
              textContent: 'claude.com/claude-code',
              href: 'https://claude.com/claude-code',
              target: '_blank',
            }),
          ],
        }),
        $li({
          children: [
            $p({ textContent: 'Add this MCP server' }),
            $pre({ textContent: claudeCodeMcpAddCommand(options) }),
          ],
        }),
        $li({
          textContent: `In Claude Code, run /mcp, select ${options.serverName}, and choose Authenticate to sign in.`,
        }),
      ],
    }),
  ];
}

function renderClaudeDesktopSetup(options: McpClientSetupOptions) {
  return [
    $h3({ textContent: 'Claude Desktop' }),
    $ul({
      children: [
        $li({
          textContent:
            'Open Settings, go to Connectors, and choose Add custom connector.',
        }),
        $li({
          children: [
            $p({ textContent: 'Name' }),
            $pre({ textContent: options.serverName }),
            $p({ textContent: 'Remote MCP server URL' }),
            $pre({ textContent: options.mcpUrl }),
          ],
        }),
        ...(options.oauthClientId
          ? [
              $li({
                children: [
                  $p({
                    textContent:
                      'Under Advanced settings, set OAuth Client ID and leave OAuth Client Secret empty.',
                  }),
                  $pre({ textContent: options.oauthClientId }),
                ],
              }),
            ]
          : []),
        $li({
          textContent:
            'Choose Add, then Connect to sign in. Claude Desktop reaches the server from the internet, so a localhost URL will not work.',
        }),
      ],
    }),
  ];
}

function renderCodexSetup(options: McpClientSetupOptions) {
  const callbackPortSetting = codexMcpCallbackPortSetting(options);

  return [
    $h3({ textContent: 'Codex' }),
    $ul({
      children: [
        $li({
          children: [
            $span({ textContent: 'Install the Codex CLI ' }),
            $a({
              textContent: 'developers.openai.com/codex',
              href: 'https://developers.openai.com/codex',
              target: '_blank',
            }),
          ],
        }),
        $li({
          children: [
            $p({ textContent: 'Add this MCP server' }),
            $pre({ textContent: codexMcpAddCommand(options) }),
          ],
        }),
        ...(callbackPortSetting
          ? [
              $li({
                children: [
                  $p({
                    textContent: `Pin the OAuth callback port: in ~/.codex/config.toml, add this line to the [mcp_servers.${options.serverName}.oauth] table that the previous command wrote`,
                  }),
                  $pre({ textContent: callbackPortSetting }),
                ],
              }),
            ]
          : []),
        $li({
          children: [
            $p({ textContent: 'Sign in' }),
            $pre({ textContent: codexMcpLoginCommand(options) }),
          ],
        }),
      ],
    }),
  ];
}

function renderGroup(group: McpToolCatalogGroup) {
  return $section({
    children: [
      $h2({
        children: [
          $span({ textContent: group.label }),
          $span({
            className: 'count',
            textContent: group.tools.length.toString(),
          }),
        ],
      }),
      $div({
        className: 'tool-list',
        children: group.tools.map(renderToolCard),
      }),
    ],
  });
}

function renderToolCard(tool: McpToolCatalogEntry) {
  const annotations =
    tool.annotations && Object.keys(tool.annotations).length
      ? $div({
          className: 'annotations',
          children: [
            $strong({ textContent: 'Annotations: ' }),
            $span({
              textContent: stringifyCompact(tool.annotations),
            }),
          ],
        })
      : '';

  return $article({
    className: 'tool-card',
    children: [
      $div({
        className: 'tool-heading',
        children: [
          $code({ className: 'tool-name', textContent: tool.name }),
          tool.title ? $p({ className: 'title', textContent: tool.title }) : '',
        ],
      }),
      $div({
        className: 'tool-description',
        children: [
          $span({ className: 'label', textContent: 'Description' }),
          $p({
            textContent: tool.description || 'No description provided.',
          }),
          annotations,
        ],
      }),
      $div({
        className: 'tool-schema',
        children: [
          $span({ className: 'label', textContent: 'Input schema' }),
          $details({
            children: [
              $summary({ textContent: 'View schema' }),
              $pre({
                textContent: stringifyPretty(tool.jsonSchema ?? {}),
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function groupTools(
  tools: McpToolCatalogEntry[],
  config: McpToolCatalogRenderConfig,
): McpToolCatalogGroup[] {
  const grouped = tools.reduce<Record<string, McpToolCatalogEntry[]>>(
    (acc, tool) => {
      const label = (config.resolveGroupLabel ?? defaultResolveGroupLabel)(
        tool.name,
      );
      acc[label] = [...(acc[label] ?? []), tool];
      return acc;
    },
    {},
  );
  const groupOrder = config.groupOrder ?? defaultGroupOrder;
  const orderedLabels = [
    ...groupOrder.filter((label) => grouped[label]?.length),
    ...Object.keys(grouped)
      .filter((label) => !groupOrder.includes(label))
      .sort((a, b) => a.localeCompare(b)),
  ];

  return orderedLabels.map((label) => ({ label, tools: grouped[label] }));
}

/**
 * Groups by the verb in the tool name, which is the only thing this package can
 * know about a catalogue it did not define. Group by subject instead -- the
 * division most catalogues actually want -- by passing `resolveGroupLabel`.
 */
function defaultResolveGroupLabel(name: string) {
  for (const verb of ['search', 'get', 'list', 'create', 'update', 'delete']) {
    if (name.includes(`-${verb}-`) || name.startsWith(`${verb}-`)) {
      return verb[0].toUpperCase() + verb.slice(1);
    }
  }
  return 'Other';
}

function stringifyPretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function stringifyCompact(value: unknown) {
  return JSON.stringify(value);
}

const $section = (props?: Parameters<typeof $div>[0]) =>
  $div({
    ...props,
    className: ['section', props?.className].filter(Boolean).join(' '),
  });
const $article = (props?: Parameters<typeof $div>[0]) =>
  $div({
    ...props,
    className: ['article', props?.className].filter(Boolean).join(' '),
  });

const styles = `
  :root {
    --ink: #13201a;
    --muted: #607065;
    --paper: #fbf8f1;
    --panel: #ffffff;
    --line: #dcd2bf;
    --accent: #0f766e;
    --accent-soft: #d6f3ed;
    --code: #23342b;
  }

  * { box-sizing: border-box; }

  html, body { min-height: 100%; }

  body {
    margin: 0;
    color: var(--ink);
    background:
      radial-gradient(circle at 18% 8%, rgba(15, 118, 110, 0.16), transparent 28rem),
      linear-gradient(135deg, #fbf8f1 0%, #f4efe3 44%, #edf5ef 100%);
    font-family: ui-serif, Georgia, Cambria, "Times New Roman", serif;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  main {
    width: min(1180px, calc(100vw - 32px));
    margin: 0 auto;
    padding: 48px 0;
  }

  .hero {
    margin-bottom: 28px;
    padding: 32px;
    border: 1px solid var(--line);
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.72);
    box-shadow: 0 18px 60px rgba(36, 41, 38, 0.08);
  }

  .eyebrow {
    display: inline-flex;
    margin-bottom: 12px;
    padding: 6px 10px;
    border-radius: 999px;
    color: #084d48;
    background: var(--accent-soft);
    font: 700 12px/1 ui-sans-serif, system-ui, sans-serif;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    font-size: clamp(2.25rem, 7vw, 5.25rem);
    line-height: 0.92;
    letter-spacing: -0.055em;
  }

  .lede {
    max-width: 780px;
    margin: 18px 0 0;
    color: var(--muted);
    font-size: 1.15rem;
  }

  .section {
    margin-top: 24px;
    border: 1px solid var(--line);
    border-radius: 20px;
    overflow: hidden;
    background: var(--panel);
  }

  h2 {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 0;
    padding: 18px 22px;
    background: #f7f2e8;
    font-size: 1.35rem;
  }

  .hero h2 { margin-top: 28px; border-radius: 12px; }

  h3 {
    margin: 22px 0 4px;
    font-size: 1.1rem;
  }

  .count {
    min-width: 2.2rem;
    padding: 4px 10px;
    border-radius: 999px;
    color: white;
    background: var(--accent);
    font: 700 0.85rem/1 ui-sans-serif, system-ui, sans-serif;
    text-align: center;
  }

  .tool-list { display: grid; gap: 0; }

  .tool-card {
    display: grid;
    gap: 18px;
    padding: 22px;
    border-top: 1px solid var(--line);
  }

  .tool-card:nth-child(even) { background: #fdfbf6; }

  .tool-heading { display: grid; gap: 8px; }

  .tool-name {
    display: inline-block;
    width: fit-content;
    max-width: 100%;
    padding: 8px 10px;
    border: 1px solid #cfe7df;
    border-radius: 10px;
    background: #effaf6;
    color: var(--code);
    font: 800 1rem/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    overflow-wrap: anywhere;
  }

  .label {
    display: block;
    margin-bottom: 8px;
    color: var(--muted);
    font: 800 0.72rem/1 ui-sans-serif, system-ui, sans-serif;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .tool-description p, .annotations { margin: 0; line-height: 1.55; }

  .title { margin: 0; color: var(--muted); font-size: 0.95rem; }

  .annotations { margin-top: 8px; color: var(--muted); font-size: 0.9rem; }

  .tool-schema { min-width: 0; }

  summary {
    cursor: pointer;
    color: var(--accent);
    font: 700 0.9rem/1 ui-sans-serif, system-ui, sans-serif;
  }

  pre {
    max-height: 520px;
    margin: 10px 0 0;
    padding: 16px;
    overflow: auto;
    border-radius: 14px;
    color: #d9f4ec;
    background: #14231d;
    font: 0.84rem/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }

  @media (max-width: 760px) {
    main { width: min(100vw - 20px, 1180px); padding: 20px 0; }
    .hero { padding: 22px; }
    .tool-card { padding: 18px; }
  }
`;
