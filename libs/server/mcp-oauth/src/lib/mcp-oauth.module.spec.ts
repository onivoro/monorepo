import { Test } from '@nestjs/testing';
import { McpOAuthModule } from './mcp-oauth.module';
import { MCP_OAUTH_CONFIG, MCP_OAUTH_SERVER_PROVIDER } from './mcp-oauth.constants';
import { McpMemoryClientsStore } from './mcp-memory-clients-store';

const mockMcpAuthRouter = jest.fn().mockReturnValue((_req: any, _res: any, next: any) => next());

jest.mock('@modelcontextprotocol/sdk/server/auth/router.js', () => ({
  mcpAuthRouter: (...args: any[]) => mockMcpAuthRouter(...args),
}));

const mockProvider = {
  clientsStore: { getClient: jest.fn() },
  authorize: jest.fn(),
  challengeForAuthorizationCode: jest.fn(),
  exchangeAuthorizationCode: jest.fn(),
  exchangeRefreshToken: jest.fn(),
  verifyAccessToken: jest.fn(),
};

describe('McpOAuthModule', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should compile with register() using an instance provider', async () => {
    const module = await Test.createTestingModule({
      imports: [
        McpOAuthModule.register({
          provider: mockProvider as any,
          issuerUrl: 'https://auth.example.com',
        }),
      ],
    }).compile();

    expect(module.get(MCP_OAUTH_CONFIG)).toBeDefined();
    expect(module.get(MCP_OAUTH_SERVER_PROVIDER)).toBe(mockProvider);
    expect(module.get(McpMemoryClientsStore)).toBeDefined();
  });

  it('should forward config options to mcpAuthRouter', async () => {
    const module = await Test.createTestingModule({
      imports: [
        McpOAuthModule.register({
          provider: mockProvider as any,
          issuerUrl: 'https://auth.example.com',
          scopesSupported: ['read', 'write'],
          resourceName: 'Test MCP Server',
        }),
      ],
    }).compile();

    const app = module.createNestApplication();
    await app.init();

    expect(mockMcpAuthRouter).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: mockProvider,
        issuerUrl: new URL('https://auth.example.com'),
        scopesSupported: ['read', 'write'],
        resourceName: 'Test MCP Server',
      }),
    );

    await app.close();
  });

  it('should compile with registerAsync() using an instance provider', async () => {
    const module = await Test.createTestingModule({
      imports: [
        McpOAuthModule.registerAsync({
          useFactory: () => ({
            provider: mockProvider as any,
            issuerUrl: 'https://auth.example.com',
          }),
        }),
      ],
    }).compile();

    const config = module.get(MCP_OAUTH_CONFIG);
    expect(config.issuerUrl).toBe('https://auth.example.com');
    expect(module.get(MCP_OAUTH_SERVER_PROVIDER)).toBe(mockProvider);
  });

  it('should export McpMemoryClientsStore', async () => {
    const module = await Test.createTestingModule({
      imports: [
        McpOAuthModule.register({
          provider: mockProvider as any,
          issuerUrl: 'https://auth.example.com',
        }),
      ],
    }).compile();

    const store = module.get(McpMemoryClientsStore);
    expect(store).toBeDefined();
    expect(store.size).toBe(0);
  });

  it('should forward optional URL config fields', async () => {
    const module = await Test.createTestingModule({
      imports: [
        McpOAuthModule.register({
          provider: mockProvider as any,
          issuerUrl: 'https://auth.example.com',
          baseUrl: 'https://base.example.com',
          resourceServerUrl: 'https://resource.example.com',
          serviceDocumentationUrl: 'https://docs.example.com',
        }),
      ],
    }).compile();

    const app = module.createNestApplication();
    await app.init();

    expect(mockMcpAuthRouter).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: new URL('https://base.example.com'),
        resourceServerUrl: new URL('https://resource.example.com'),
        serviceDocumentationUrl: new URL('https://docs.example.com'),
      }),
    );

    await app.close();
  });
});
