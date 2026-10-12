import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { McpAuthModule } from './mcp-auth.module';
import { MCP_AUTH_CONFIG } from './mcp-auth-config-token';
import { MCP_COGNITO_AUTH_CONFIG } from './mcp-cognito-auth-config-token';
import { McpJwtAuthStrategy } from './mcp-jwt-auth-strategy';
import { McpProtectedResourceController } from './mcp-protected-resource.controller';

jest.mock('jwks-rsa', () => ({
  JwksClient: jest
    .fn()
    .mockImplementation(() => ({ getSigningKey: jest.fn() })),
}));

describe('McpAuthModule validation', () => {
  const cognito = {
    region: 'us-east-1',
    userPoolId: 'us-east-1_Pool',
    clientId: 'client',
    resourceServerUrl: 'https://api.example.com/mcp',
  };

  it.each([
    ['userPoolId', { userPoolId: '' }],
    ['clientId', { clientId: '' }],
  ])('configureCognito requires %s', (field, override) => {
    expect(() =>
      McpAuthModule.configureCognito({ ...cognito, ...override }),
    ).toThrow(`McpAuthModule.configureCognito requires ${field}.`);
  });

  it('configureCognito requires resourceServerUrl while metadata is served', () => {
    expect(() =>
      McpAuthModule.configureCognito({
        ...cognito,
        resourceServerUrl: undefined,
      }),
    ).toThrow(/resourceServerUrl/);
  });

  it('configureCognito omits the controller and skips URL validation when metadata is disabled', () => {
    const dynamicModule = McpAuthModule.configureCognito({
      ...cognito,
      resourceServerUrl: undefined,
      serveProtectedResourceMetadata: false,
    });

    expect(dynamicModule.controllers).toEqual([]);
  });

  it('configureJwt rejects a config that would accept tokens for any audience', () => {
    expect(() =>
      McpAuthModule.configureJwt({
        jwksUri: 'https://auth.example.com/jwks.json',
        issuer: 'https://auth.example.com',
        resourceServerUrl: 'https://mcp.example.com',
      }),
    ).toThrow(/requires audience or resourceIdentifier/);
  });

  it('configureJwt accepts resourceIdentifier as the audience check', () => {
    expect(() =>
      McpAuthModule.configureJwt({
        jwksUri: 'https://auth.example.com/jwks.json',
        issuer: 'https://auth.example.com',
        resourceIdentifier: 'https://mcp.example.com',
        resourceServerUrl: 'https://mcp.example.com',
      }),
    ).not.toThrow();
  });

  it('configureJwt accepts allowAnyAudience, with a warning', () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    expect(() =>
      McpAuthModule.configureJwt({
        jwksUri: 'https://auth.example.com/jwks.json',
        issuer: 'https://auth.example.com',
        allowAnyAudience: true,
        resourceServerUrl: 'https://mcp.example.com',
      }),
    ).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('allowAnyAudience'),
    );
    warn.mockRestore();
  });

  it('configureJwtAsync rejects a factory config without an audience check', async () => {
    await expect(
      Test.createTestingModule({
        imports: [
          McpAuthModule.configureJwtAsync({
            useFactory: () => ({
              jwksUri: 'https://auth.example.com/jwks.json',
              issuer: 'https://auth.example.com',
              resourceServerUrl: 'https://mcp.example.com',
            }),
          }),
        ],
      }).compile(),
    ).rejects.toThrow(/requires audience or resourceIdentifier/);
  });

  it('configureJwt accepts authorizationServers without an issuer', () => {
    const dynamicModule = McpAuthModule.configureJwt({
      jwksUri: 'https://auth.example.com/jwks.json',
      audience: 'https://mcp.example.com',
      resourceServerUrl: 'https://api.example.com/mcp',
      authorizationServers: ['https://auth.example.com'],
    });

    expect(dynamicModule.controllers).toEqual([McpProtectedResourceController]);
  });

  it('configureJwt rejects an empty authorizationServers list without an issuer', () => {
    expect(() =>
      McpAuthModule.configureJwt({
        jwksUri: 'https://auth.example.com/jwks.json',
        audience: 'https://mcp.example.com',
        resourceServerUrl: 'https://api.example.com/mcp',
        authorizationServers: [],
      }),
    ).toThrow(/authorizationServers or issuer/);
  });

  it('configureJwtAsync rejects an invalid config produced by the factory', async () => {
    await expect(
      Test.createTestingModule({
        imports: [
          McpAuthModule.configureJwtAsync({
            useFactory: async () => ({
              jwksUri: 'https://auth.example.com/jwks.json',
              audience: 'https://mcp.example.com',
            }),
          }),
        ],
      }).compile(),
    ).rejects.toThrow(/resourceServerUrl/);
  });

  it('configureCognitoAsync rejects an invalid Cognito config produced by the factory', async () => {
    await expect(
      Test.createTestingModule({
        imports: [
          McpAuthModule.configureCognitoAsync({
            useFactory: () => ({ ...cognito, region: '' }),
          }),
        ],
      }).compile(),
    ).rejects.toThrow(/requires region/);
  });

  it('configureCognitoAsync derives MCP_AUTH_CONFIG from the Cognito config', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        McpAuthModule.configureCognitoAsync({ useFactory: () => cognito }),
      ],
    }).compile();

    expect(moduleRef.get(MCP_COGNITO_AUTH_CONFIG)).toEqual(cognito);
    expect(moduleRef.get(MCP_AUTH_CONFIG)).toEqual(
      expect.objectContaining({
        issuer: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_Pool',
        jwksUri:
          'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_Pool/.well-known/jwks.json',
      }),
    );
  });

  it('registerAsync is a backwards-compatible alias for configureJwtAsync', async () => {
    const config = {
      jwksUri: 'https://auth.example.com/jwks.json',
      audience: 'https://mcp.example.com',
      issuer: 'https://auth.example.com',
      resourceServerUrl: 'https://api.example.com/mcp',
    };
    const moduleRef = await Test.createTestingModule({
      imports: [McpAuthModule.registerAsync({ useFactory: () => config })],
    }).compile();

    expect(moduleRef.get(MCP_AUTH_CONFIG)).toEqual(config);
    expect(moduleRef.get(McpJwtAuthStrategy)).toBeInstanceOf(
      McpJwtAuthStrategy,
    );
  });
});
