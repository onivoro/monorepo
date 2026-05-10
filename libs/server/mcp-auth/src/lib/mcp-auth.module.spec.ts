import { Test } from '@nestjs/testing';
import { MCP_AUTH_CONFIG } from './mcp-auth-config-token';
import { MCP_COGNITO_AUTH_CONFIG } from './mcp-cognito-auth-config-token';
import { McpAuthModule } from './mcp-auth.module';
import { McpCognitoAuthStrategy } from './mcp-cognito-auth-strategy';
import { McpJwksService } from './mcp-jwks.service';
import { McpJwtAuthStrategy } from './mcp-jwt-auth-strategy';
import { McpScopeRegistry } from './mcp-scope-registry';

jest.mock('jwks-rsa', () => ({
  JwksClient: jest.fn().mockImplementation(() => ({
    getSigningKey: jest.fn(),
  })),
}));

describe('McpAuthModule', () => {
  it('should compile with configureJwt() and provide all services', async () => {
    const module = await Test.createTestingModule({
      imports: [
        McpAuthModule.configureJwt({
          jwksUri: 'https://example.com/.well-known/jwks.json',
          issuer: 'https://example.com',
          resourceServerUrl: 'https://api.example.com/mcp',
        }),
      ],
    }).compile();

    expect(module.get(McpJwtAuthStrategy)).toBeDefined();
    expect(module.get(McpJwksService)).toBeDefined();
    expect(module.get(McpScopeRegistry)).toBeDefined();
    expect(module.get(MCP_AUTH_CONFIG)).toBeDefined();
  });

  it('should keep register() as a backwards-compatible alias for JWT auth', async () => {
    const module = await Test.createTestingModule({
      imports: [
        McpAuthModule.register({
          jwksUri: 'https://example.com/.well-known/jwks.json',
          issuer: 'https://example.com',
          resourceServerUrl: 'https://api.example.com/mcp',
        }),
      ],
    }).compile();

    expect(module.get(McpJwtAuthStrategy)).toBeDefined();
  });

  it('should compile with configureCognito() and provide the Cognito strategy', async () => {
    const module = await Test.createTestingModule({
      imports: [
        McpAuthModule.configureCognito({
          region: 'us-east-2',
          userPoolId: 'us-east-2_example',
          clientId: 'example-client-id',
          resourceServerUrl: 'https://api.example.com/mcp',
        }),
      ],
    }).compile();

    expect(module.get(McpCognitoAuthStrategy)).toBeDefined();
    expect(module.get(MCP_COGNITO_AUTH_CONFIG)).toEqual({
      region: 'us-east-2',
      userPoolId: 'us-east-2_example',
      clientId: 'example-client-id',
      resourceServerUrl: 'https://api.example.com/mcp',
    });
  });

  it('should include the protected resource controller by default', async () => {
    const module = await Test.createTestingModule({
      imports: [
        McpAuthModule.configureJwt({
          jwksUri: 'https://example.com/.well-known/jwks.json',
          resourceServerUrl: 'https://api.example.com/mcp',
          issuer: 'https://auth.example.com',
        }),
      ],
    }).compile();

    const app = module.createNestApplication();
    await app.init();

    expect(app.getHttpServer()).toBeDefined();

    await app.close();
  });

  it('should exclude the protected resource controller when serveProtectedResourceMetadata is false', async () => {
    const module = await Test.createTestingModule({
      imports: [
        McpAuthModule.configureJwt({
          jwksUri: 'https://example.com/.well-known/jwks.json',
          serveProtectedResourceMetadata: false,
        }),
      ],
    }).compile();

    expect(module.get(McpJwtAuthStrategy)).toBeDefined();
    expect(module.get(McpScopeRegistry)).toBeDefined();
  });

  it('should compile with configureJwtAsync()', async () => {
    const module = await Test.createTestingModule({
      imports: [
        McpAuthModule.configureJwtAsync({
          useFactory: () => ({
            jwksUri: 'https://example.com/.well-known/jwks.json',
            issuer: 'https://example.com',
            resourceServerUrl: 'https://api.example.com/mcp',
          }),
        }),
      ],
    }).compile();

    expect(module.get(McpJwtAuthStrategy)).toBeDefined();
    expect(module.get(MCP_AUTH_CONFIG)).toEqual({
      jwksUri: 'https://example.com/.well-known/jwks.json',
      issuer: 'https://example.com',
      resourceServerUrl: 'https://api.example.com/mcp',
    });
  });

  it('should compile with configureCognitoAsync()', async () => {
    const module = await Test.createTestingModule({
      imports: [
        McpAuthModule.configureCognitoAsync({
          useFactory: () => ({
            region: 'us-east-2',
            userPoolId: 'us-east-2_example',
            clientId: 'example-client-id',
            resourceServerUrl: 'https://api.example.com/mcp',
          }),
        }),
      ],
    }).compile();

    expect(module.get(McpCognitoAuthStrategy)).toBeDefined();
  });

  it('should export McpJwtAuthStrategy for use as authStrategy in MCP modules', async () => {
    const module = await Test.createTestingModule({
      imports: [
        McpAuthModule.configureJwt({
          jwksUri: 'https://example.com/.well-known/jwks.json',
          serveProtectedResourceMetadata: false,
        }),
      ],
    }).compile();

    const provider = module.get(McpJwtAuthStrategy);
    expect(provider.resolveAuth).toBeDefined();
    expect(provider.verifyAccessToken).toBeDefined();
  });

  it('should return empty scopes when McpToolRegistry is not available', async () => {
    const module = await Test.createTestingModule({
      imports: [
        McpAuthModule.configureJwt({
          jwksUri: 'https://example.com/.well-known/jwks.json',
          serveProtectedResourceMetadata: false,
        }),
      ],
    }).compile();

    await module.init();

    const scopeRegistry = module.get(McpScopeRegistry);
    expect(scopeRegistry.getScopesArray()).toEqual([]);
  });

  it('should validate required Cognito config fields', () => {
    expect(() => McpAuthModule.configureCognito({
      region: '',
      userPoolId: 'pool',
      clientId: 'client',
      resourceServerUrl: 'https://api.example.com/mcp',
    })).toThrow(/region/);
  });

  it('should reject missing resourceServerUrl when protected resource metadata is enabled', () => {
    expect(() => McpAuthModule.configureJwt({
      jwksUri: 'https://example.com/.well-known/jwks.json',
      issuer: 'https://example.com',
    })).toThrow(/resourceServerUrl/);
  });

  it('should reject missing authorization server sources when protected resource metadata is enabled', () => {
    expect(() => McpAuthModule.configureJwt({
      jwksUri: 'https://example.com/.well-known/jwks.json',
      resourceServerUrl: 'https://api.example.com/mcp',
    })).toThrow(/authorizationServers or issuer/);
  });
});
