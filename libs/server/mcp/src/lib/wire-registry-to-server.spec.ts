import { McpToolRegistry } from './mcp-tool-registry';
import { buildCapabilities, wireRegistryToServer } from './wire-registry-to-server';
import { z } from 'zod';

const mockRegisterTool = jest.fn();
const mockRegisterResource = jest.fn();
const mockRegisterPrompt = jest.fn();

jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn(),
  ResourceTemplate: jest.fn().mockImplementation((uri: string) => ({ uri })),
}));

function createMockServer() {
  return {
    registerTool: mockRegisterTool,
    registerResource: mockRegisterResource,
    registerPrompt: mockRegisterPrompt,
  } as any;
}

describe('buildCapabilities', () => {
  let registry: McpToolRegistry;

  beforeEach(() => {
    registry = new McpToolRegistry();
  });

  it('should return empty object when nothing is registered', () => {
    expect(buildCapabilities(registry)).toEqual({});
  });

  it('should include tools key when tools are registered', () => {
    registry.registerTool({ name: 'tool', description: 'd' }, jest.fn());
    const caps = buildCapabilities(registry);
    expect(caps).toEqual({ tools: {} });
  });

  it('should include all keys when tools, resources, and prompts are registered', () => {
    registry.registerTool({ name: 'tool', description: 'd' }, jest.fn());
    registry.registerResource({ name: 'res', uri: 'app://res' }, jest.fn());
    registry.registerPrompt({ name: 'prompt' }, jest.fn());
    const caps = buildCapabilities(registry);
    expect(caps).toEqual({ tools: {}, resources: {}, prompts: {} });
  });
});

describe('wireRegistryToServer', () => {
  let registry: McpToolRegistry;

  beforeEach(() => {
    jest.clearAllMocks();
    registry = new McpToolRegistry();
  });

  it('should register tools with correct args', () => {
    const schema = z.object({ text: z.string() });
    registry.registerTool({ name: 'my-tool', description: 'A tool', schema }, jest.fn());

    wireRegistryToServer(registry, createMockServer());

    expect(mockRegisterTool).toHaveBeenCalledTimes(1);
    expect(mockRegisterTool).toHaveBeenCalledWith(
      'my-tool',
      { description: 'A tool', inputSchema: schema.shape },
      expect.any(Function),
    );
  });

  it('should pass tool annotations to the server when present', () => {
    const annotations = { readOnlyHint: true, destructiveHint: false };
    registry.registerTool(
      { name: 'read-tool', description: 'Reads data', annotations },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    const config = mockRegisterTool.mock.calls[0][1];
    expect(config.annotations).toEqual(annotations);
  });

  it('should omit annotations from tool config when not present', () => {
    registry.registerTool({ name: 'tool', description: 'd' }, jest.fn());

    wireRegistryToServer(registry, createMockServer());

    const config = mockRegisterTool.mock.calls[0][1];
    expect(config).not.toHaveProperty('annotations');
  });

  it('should pass tool title to the server when present', () => {
    registry.registerTool(
      { name: 'list-items', description: 'List items', title: 'List Items' },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    const config = mockRegisterTool.mock.calls[0][1];
    expect(config.title).toBe('List Items');
  });

  it('should omit tool title when not present', () => {
    registry.registerTool({ name: 'tool', description: 'd' }, jest.fn());

    wireRegistryToServer(registry, createMockServer());

    const config = mockRegisterTool.mock.calls[0][1];
    expect(config).not.toHaveProperty('title');
  });

  it('should delegate tool callback to registry.executeToolWrapped', async () => {
    const handler = jest.fn().mockResolvedValue('result');
    registry.registerTool({ name: 'tool', description: 'd' }, handler);

    wireRegistryToServer(registry, createMockServer());

    const callback = mockRegisterTool.mock.calls[0][2];
    await callback({ text: 'hello' });
    expect(handler).toHaveBeenCalledWith(
      { text: 'hello' },
      expect.objectContaining({ toolName: 'tool', params: { text: 'hello' } }),
    );
  });

  it('should forward authInfo from MCP SDK extra parameter', async () => {
    const handler = jest.fn().mockResolvedValue('result');
    registry.registerTool({ name: 'tool', description: 'd' }, handler);

    wireRegistryToServer(registry, createMockServer());

    const callback = mockRegisterTool.mock.calls[0][2];
    const mockAuthInfo = { token: 'abc', clientId: 'c1', scopes: ['read'] };
    await callback({ text: 'hi' }, { authInfo: mockAuthInfo, signal: new AbortController().signal });

    expect(handler).toHaveBeenCalledWith(
      { text: 'hi' },
      expect.objectContaining({ authInfo: mockAuthInfo }),
    );
  });

  it('should register static resources with URI string', () => {
    registry.registerResource(
      { name: 'config', uri: 'app://config', description: 'Config', mimeType: 'application/json' },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    expect(mockRegisterResource).toHaveBeenCalledTimes(1);
    expect(mockRegisterResource).toHaveBeenCalledWith(
      'config',
      'app://config',
      { description: 'Config', mimeType: 'application/json' },
      expect.any(Function),
    );
  });

  it('should pass resource title and size to the server when present', () => {
    registry.registerResource(
      { name: 'db-dump', uri: 'app://db-dump', title: 'Database Dump', description: 'Full DB', size: 1048576 },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    const config = mockRegisterResource.mock.calls[0][2];
    expect(config.title).toBe('Database Dump');
    expect(config.size).toBe(1048576);
  });

  it('should register template resources with ResourceTemplate', () => {
    registry.registerResource(
      { name: 'item', uri: 'item://{id}', isTemplate: true },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    expect(mockRegisterResource).toHaveBeenCalledTimes(1);
    expect(mockRegisterResource.mock.calls[0][0]).toBe('item');
    expect(mockRegisterResource.mock.calls[0][1]).toEqual({ uri: 'item://{id}' });
  });

  it('should pass prompt title to the server when present', () => {
    registry.registerPrompt(
      { name: 'summarize', title: 'Summarize Item', description: 'Generate a summary' },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    const config = mockRegisterPrompt.mock.calls[0][1];
    expect(config.title).toBe('Summarize Item');
  });

  it('should register prompts with correct args', () => {
    const argsSchema = { itemId: z.string() };
    registry.registerPrompt(
      { name: 'summarize', description: 'Summarize', argsSchema },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    expect(mockRegisterPrompt).toHaveBeenCalledTimes(1);
    expect(mockRegisterPrompt).toHaveBeenCalledWith(
      'summarize',
      { description: 'Summarize', argsSchema },
      expect.any(Function),
    );
  });

  it('should handle empty registry without errors', () => {
    expect(() => wireRegistryToServer(registry, createMockServer())).not.toThrow();
    expect(mockRegisterTool).not.toHaveBeenCalled();
    expect(mockRegisterResource).not.toHaveBeenCalled();
    expect(mockRegisterPrompt).not.toHaveBeenCalled();
  });
});
