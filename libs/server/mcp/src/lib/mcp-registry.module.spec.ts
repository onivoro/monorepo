import { Injectable, Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { z } from 'zod';
import { McpRegistryModule } from './mcp-registry.module';
import { McpToolRegistry } from './mcp-tool-registry';
import { McpScopeGuard } from './mcp-scope-guard';
import { McpTool } from './mcp-tool.decorator';
import { McpGuard } from './mcp-guard.decorator';
import { McpResource } from './mcp-resource.decorator';
import { McpPrompt } from './mcp-prompt.decorator';
import type { McpAuthInfo } from './mcp-auth-info';

@Injectable()
class ListStrategy {
  list() {
    return { resources: [] };
  }
}

@Injectable()
class ToolService {
  @McpTool({
    name: 'echo',
    description: 'Echo input',
    schema: z.object({ input: z.string() }),
  })
  async echo(params: { input: string }) {
    return `echo: ${params.input}`;
  }

  @McpTool({ name: 'write-item', description: 'Requires write scope' })
  @McpGuard(McpScopeGuard, { scopes: ['write'] })
  async writeItem() {
    return 'written';
  }

  @McpResource({ name: 'config', uri: 'app://config' })
  async config() {
    return 'config data';
  }

  @McpPrompt({ name: 'greet' })
  async greet() {
    return 'hello';
  }
}

const auth = (scopes: string[]): McpAuthInfo => ({
  token: 't',
  clientId: 'c',
  scopes,
});

describe('McpRegistryModule', () => {
  let module: TestingModule;
  let registry: McpToolRegistry;

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    module = await Test.createTestingModule({
      imports: [McpRegistryModule.registerOnly()],
      providers: [ToolService, ListStrategy],
    }).compile();
    await module.init();
    registry = module.get(McpToolRegistry);
  });

  afterEach(async () => {
    await module.close();
    jest.restoreAllMocks();
  });

  it('should describe a DynamicModule exporting the registry', () => {
    const dyn = McpRegistryModule.registerOnly();
    expect(dyn.module).toBe(McpRegistryModule);
    expect(dyn.providers).toEqual(
      expect.arrayContaining([McpToolRegistry, McpScopeGuard]),
    );
    expect(dyn.exports).toEqual([McpToolRegistry]);
  });

  it('should discover decorated tools, resources and prompts on init', () => {
    expect(registry.getTools().map((t) => t.metadata.name)).toEqual(
      expect.arrayContaining(['echo', 'write-item']),
    );
    expect(registry.getResources().map((r) => r.metadata.name)).toEqual([
      'config',
    ]);
    expect(registry.getPrompts().map((p) => p.metadata.name)).toEqual([
      'greet',
    ]);
  });

  it('should register @McpGuard metadata with discovered tools', () => {
    expect(registry.getToolGuards('write-item')).toEqual([
      { guardClass: McpScopeGuard, config: { scopes: ['write'] } },
    ]);
    expect(registry.getToolGuards('echo')).toEqual([]);
  });

  it('should execute discovered tools bound to their instance', async () => {
    await expect(
      registry.executeToolRaw('echo', { input: 'hi' }),
    ).resolves.toBe('echo: hi');
  });

  it('should resolve guards through DI and deny calls missing required scopes', async () => {
    await expect(
      registry.executeToolRaw('write-item', {}, auth(['read'])),
    ).rejects.toThrow('Access denied by McpScopeGuard for tool "write-item".');
    await expect(registry.executeToolRaw('write-item', {})).rejects.toThrow(
      /Access denied/,
    );
  });

  it('should allow guarded calls when required scopes are present', async () => {
    await expect(
      registry.executeToolRaw('write-item', {}, auth(['read', 'write'])),
    ).resolves.toBe('written');
  });

  it('should resolve arbitrary providers through DI', () => {
    expect(registry.resolveProvider(ListStrategy)).toBe(
      module.get(ListStrategy),
    );
  });
});
