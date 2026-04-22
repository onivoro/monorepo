import { Test } from '@nestjs/testing';
import { McpProtectedResourceController } from './mcp-protected-resource.controller';
import { McpScopeRegistry } from './mcp-scope-registry';
import { MCP_AUTH_CONFIG } from './mcp-auth-config-token';
import type { McpAuthConfig } from './mcp-auth-config';

describe('McpProtectedResourceController', () => {
  function createController(config: McpAuthConfig, scopes: string[] = []) {
    const mockScopeRegistry = { getScopesArray: jest.fn().mockReturnValue(scopes) };

    const controller = new McpProtectedResourceController(config, mockScopeRegistry as any);
    return { controller, mockScopeRegistry };
  }

  it('should return full metadata when all config fields are set', () => {
    const { controller } = createController(
      {
        jwksUri: 'https://example.com/jwks',
        resourceServerUrl: 'https://api.example.com/mcp',
        authorizationServers: ['https://auth.example.com'],
        resourceName: 'My MCP Server',
        resourceDocumentationUrl: 'https://docs.example.com',
      },
      ['read', 'write'],
    );

    const result = controller.getProtectedResourceMetadata();

    expect(result).toEqual({
      resource: 'https://api.example.com/mcp',
      bearer_methods_supported: ['header'],
      authorization_servers: ['https://auth.example.com'],
      scopes_supported: ['read', 'write'],
      resource_name: 'My MCP Server',
      resource_documentation: 'https://docs.example.com',
    });
  });

  it('should omit optional fields when not configured', () => {
    const { controller } = createController({
      jwksUri: 'https://example.com/jwks',
      resourceServerUrl: 'https://api.example.com/mcp',
    });

    const result = controller.getProtectedResourceMetadata();

    expect(result).toEqual({
      resource: 'https://api.example.com/mcp',
      bearer_methods_supported: ['header'],
    });
    expect(result).not.toHaveProperty('authorization_servers');
    expect(result).not.toHaveProperty('scopes_supported');
    expect(result).not.toHaveProperty('resource_name');
    expect(result).not.toHaveProperty('resource_documentation');
  });

  it('should include scopes from the scope registry', () => {
    const { controller } = createController(
      { jwksUri: 'https://example.com/jwks', resourceServerUrl: 'https://api.example.com' },
      ['admin', 'execute'],
    );

    const result = controller.getProtectedResourceMetadata();
    expect(result['scopes_supported']).toEqual(['admin', 'execute']);
  });

  it('should return empty object when serveProtectedResourceMetadata is false', () => {
    const { controller } = createController({
      jwksUri: 'https://example.com/jwks',
      resourceServerUrl: 'https://api.example.com',
      serveProtectedResourceMetadata: false,
    });

    const result = controller.getProtectedResourceMetadata();
    expect(result).toEqual({});
  });

  it('should resolve via NestJS DI', async () => {
    const module = await Test.createTestingModule({
      controllers: [McpProtectedResourceController],
      providers: [
        {
          provide: MCP_AUTH_CONFIG,
          useValue: {
            jwksUri: 'https://example.com/jwks',
            resourceServerUrl: 'https://api.example.com/mcp',
          },
        },
        {
          provide: McpScopeRegistry,
          useValue: { getScopesArray: () => ['read'] },
        },
      ],
    }).compile();

    const controller = module.get(McpProtectedResourceController);
    expect(controller).toBeDefined();

    const result = controller.getProtectedResourceMetadata();
    expect(result['resource']).toBe('https://api.example.com/mcp');
    expect(result['scopes_supported']).toEqual(['read']);
  });
});
