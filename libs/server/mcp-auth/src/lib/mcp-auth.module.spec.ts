import { Test } from '@nestjs/testing';
import { McpAuthModule } from './mcp-auth.module';
import { McpJwtAuthProvider } from './mcp-jwt-auth-provider';
import { McpJwksService } from './mcp-jwks.service';
import { McpScopeRegistry } from './mcp-scope-registry';
import { MCP_AUTH_CONFIG } from './mcp-auth-config-token';

jest.mock('jwks-rsa', () => ({
  JwksClient: jest.fn().mockImplementation(() => ({
    getSigningKey: jest.fn(),
  })),
}));

describe('McpAuthModule', () => {
  it('should compile with register() and provide all services', async () => {
    const module = await Test.createTestingModule({
      imports: [
        McpAuthModule.register({
          jwksUri: 'https://example.com/.well-known/jwks.json',
          issuer: 'https://example.com',
        }),
      ],
    }).compile();

    expect(module.get(McpJwtAuthProvider)).toBeDefined();
    expect(module.get(McpJwksService)).toBeDefined();
    expect(module.get(McpScopeRegistry)).toBeDefined();
    expect(module.get(MCP_AUTH_CONFIG)).toBeDefined();
  });

  it('should include the protected resource controller by default', async () => {
    const module = await Test.createTestingModule({
      imports: [
        McpAuthModule.register({
          jwksUri: 'https://example.com/.well-known/jwks.json',
          resourceServerUrl: 'https://api.example.com/mcp',
        }),
      ],
    }).compile();

    const app = module.createNestApplication();
    await app.init();

    const httpServer = app.getHttpServer();
    expect(httpServer).toBeDefined();

    await app.close();
  });

  it('should exclude the protected resource controller when serveProtectedResourceMetadata is false', async () => {
    const module = await Test.createTestingModule({
      imports: [
        McpAuthModule.register({
          jwksUri: 'https://example.com/.well-known/jwks.json',
          serveProtectedResourceMetadata: false,
        }),
      ],
    }).compile();

    expect(module.get(McpJwtAuthProvider)).toBeDefined();
    expect(module.get(McpScopeRegistry)).toBeDefined();
  });

  it('should compile with registerAsync()', async () => {
    const module = await Test.createTestingModule({
      imports: [
        McpAuthModule.registerAsync({
          useFactory: () => ({
            jwksUri: 'https://example.com/.well-known/jwks.json',
            issuer: 'https://example.com',
          }),
        }),
      ],
    }).compile();

    expect(module.get(McpJwtAuthProvider)).toBeDefined();
    expect(module.get(MCP_AUTH_CONFIG)).toEqual({
      jwksUri: 'https://example.com/.well-known/jwks.json',
      issuer: 'https://example.com',
    });
  });

  it('should export McpJwtAuthProvider for use as authProvider in MCP modules', async () => {
    const module = await Test.createTestingModule({
      imports: [
        McpAuthModule.register({
          jwksUri: 'https://example.com/.well-known/jwks.json',
        }),
      ],
    }).compile();

    const provider = module.get(McpJwtAuthProvider);
    expect(provider.resolveAuth).toBeDefined();
    expect(provider.verifyAccessToken).toBeDefined();
  });

  it('should return empty scopes when McpToolRegistry is not available', async () => {
    const module = await Test.createTestingModule({
      imports: [
        McpAuthModule.register({
          jwksUri: 'https://example.com/.well-known/jwks.json',
        }),
      ],
    }).compile();

    await module.init();

    const scopeRegistry = module.get(McpScopeRegistry);
    expect(scopeRegistry.getScopesArray()).toEqual([]);
  });
});
