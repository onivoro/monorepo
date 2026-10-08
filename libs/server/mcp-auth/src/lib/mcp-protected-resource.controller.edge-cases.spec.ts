import { NotFoundException } from '@nestjs/common';
import { McpProtectedResourceController } from './mcp-protected-resource.controller';
import type { McpAuthConfig } from './mcp-auth-config';

describe('McpProtectedResourceController edge cases', () => {
  const baseConfig: McpAuthConfig = {
    jwksUri: 'https://auth.example.com/.well-known/jwks.json',
    issuer: 'https://auth.example.com',
    resourceServerUrl: 'https://api.example.com/v1/mcp',
  };

  function createController(
    config: Partial<McpAuthConfig>,
    scopes: string[] = [],
  ) {
    return new McpProtectedResourceController(
      { ...baseConfig, ...config } as McpAuthConfig,
      { getScopesArray: () => scopes } as any,
    );
  }

  it('matches nested resource paths without the leading slash', () => {
    const controller = createController({});

    expect(controller.getPathProtectedResourceMetadata('v1/mcp')).toEqual(
      expect.objectContaining({ resource: baseConfig.resourceServerUrl }),
    );
    expect(() =>
      controller.getPathProtectedResourceMetadata('/v1/mcp'),
    ).toThrow(NotFoundException);
    expect(() => controller.getPathProtectedResourceMetadata('v1')).toThrow(
      NotFoundException,
    );
  });

  it('matches an empty path when the resource URL is the origin', () => {
    const controller = createController({
      resourceServerUrl: 'https://api.example.com',
    });

    expect(controller.getPathProtectedResourceMetadata('')).toEqual(
      expect.objectContaining({ resource: 'https://api.example.com' }),
    );
  });

  it('returns 404 for the path route when no resourceServerUrl is configured', () => {
    const controller = createController({ resourceServerUrl: undefined });

    expect(() => controller.getPathProtectedResourceMetadata('mcp')).toThrow(
      NotFoundException,
    );
  });

  it('returns 404 for the path route when metadata is disabled', () => {
    const controller = createController({
      serveProtectedResourceMetadata: false,
    });

    expect(() => controller.getPathProtectedResourceMetadata('v1/mcp')).toThrow(
      NotFoundException,
    );
  });

  it('serves both routes when the mode is explicitly "both"', () => {
    const controller = createController({
      protectedResourceMetadataMode: 'both',
    });

    expect(controller.getRootProtectedResourceMetadata()).toBeDefined();
    expect(controller.getPathProtectedResourceMetadata('v1/mcp')).toBeDefined();
  });

  it('prefers explicit authorizationServers over the issuer', () => {
    const controller = createController({
      authorizationServers: ['https://as.example.com'],
    });

    expect(
      controller.getRootProtectedResourceMetadata()['authorization_servers'],
    ).toEqual(['https://as.example.com']);
  });

  it('falls back to the issuer when authorizationServers is empty', () => {
    const controller = createController({ authorizationServers: [] });

    expect(
      controller.getRootProtectedResourceMetadata()['authorization_servers'],
    ).toEqual([baseConfig.issuer]);
  });

  it('omits authorization_servers when neither source is configured', () => {
    const controller = createController({
      issuer: undefined,
      authorizationServers: undefined,
    });

    const metadata = controller.getRootProtectedResourceMetadata();
    expect(metadata).not.toHaveProperty('authorization_servers');
    expect(metadata).toEqual({
      resource: baseConfig.resourceServerUrl,
      bearer_methods_supported: ['header'],
    });
  });
});
