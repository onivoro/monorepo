import { buildCapabilities } from './build-capabilities';
import { McpToolRegistry } from './mcp-tool-registry';

describe('buildCapabilities', () => {
  function registryWithATool() {
    const registry = new McpToolRegistry();
    registry.registerTool({ name: 't', description: 't' }, async () => 'ok');
    return registry;
  }

  it('adds extra capabilities next to the ones it builds', () => {
    expect(
      buildCapabilities(registryWithATool(), {
        extra: { experimental: { 'claude/channel': {} }, completions: {} },
      }),
    ).toEqual({
      experimental: { 'claude/channel': {} },
      completions: {},
      logging: {},
      tools: { listChanged: true },
    });
  });

  it('ignores the keys it builds when they are passed as extra', () => {
    const extra = {
      logging: { anything: true },
      tools: { listChanged: false },
      resources: { subscribe: true },
      prompts: {},
    };

    expect(
      buildCapabilities(registryWithATool(), {
        logging: false,
        extra: extra as object,
      }),
    ).toEqual({ tools: { listChanged: true } });
  });
});
