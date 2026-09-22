import {
  $a,
  $body,
  $code,
  $details,
  $div,
  $h1,
  $h2,
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

export type McpToolCatalogEntry = {
  annotations?: Record<string, unknown>;
  description?: string;
  jsonSchema?: Record<string, unknown>;
  name: string;
  title?: string;
};

export interface McpToolCatalogRenderConfig {
  authCommand?: string;
  /** Replaces the generated client-config snippet entirely. */
  configJson?: string;
  eyebrow?: string;
  groupOrder?: string[];
  /** Absolute MCP endpoint. Defaults to `${serverUrl}/api/mcp`. */
  mcpUrl?: string;
  resolveGroupLabel?: (name: string) => string;
  /** Key the server appears under in the generated snippet. */
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
                      textContent: safeText(
                        `${sortedTools.length} registered tools with names, descriptions, and input schemas.`,
                      ),
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
  return [
    $h2({ textContent: 'Installation Guide' }),
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
              textContent: config.configJson ?? defaultOpencodeConfig(config),
            }),
          ],
        }),
        $li({
          children: [
            $p({ textContent: 'Register this MCP server' }),
            $pre({
              textContent: config.authCommand ?? 'opencode mcp auth mcp-server',
            }),
          ],
        }),
      ],
    }),
  ];
}

/**
 * A copy-pasteable client config for this server, shown on the catalog page.
 *
 * Deliberately minimal: it names the server and nothing else. Anything about
 * which model to run, or which cloud credentials to use, belongs to whoever is
 * connecting -- so a host that wants a richer snippet supplies its own through
 * `configJson`.
 */
function defaultOpencodeConfig(config: McpToolCatalogRenderConfig): string {
  return JSON.stringify(
    {
      $schema: 'https://opencode.ai/config.json',
      mcp: {
        [config.serverName ?? 'mcp-server']: {
          type: 'remote',
          url: config.mcpUrl ?? `${config.serverUrl}/api/mcp`,
          enabled: true,
        },
      },
    },
    null,
    2,
  );
}

function renderGroup(group: McpToolCatalogGroup) {
  return $section({
    children: [
      $h2({
        children: [
          $span({ textContent: group.label }),
          $span({
            className: 'count',
            textContent: safeText(group.tools.length.toString()),
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
              textContent: safeText(stringifyCompact(tool.annotations)),
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
          $code({ className: 'tool-name', textContent: safeText(tool.name) }),
          tool.title
            ? $p({ className: 'title', textContent: safeText(tool.title) })
            : '',
        ],
      }),
      $div({
        className: 'tool-description',
        children: [
          $span({ className: 'label', textContent: 'Description' }),
          $p({
            textContent: safeText(
              tool.description || 'No description provided.',
            ),
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
                textContent: safeText(stringifyPretty(tool.jsonSchema ?? {})),
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

function safeText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
