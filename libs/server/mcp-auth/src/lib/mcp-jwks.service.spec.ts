import { McpJwksService } from './mcp-jwks.service';
import { MCP_AUTH_CONFIG } from './mcp-auth-config-token';
import type { McpAuthConfig } from './mcp-auth-config';

const mockGetSigningKey = jest.fn();

jest.mock('jwks-rsa', () => ({
  JwksClient: jest.fn().mockImplementation(() => ({
    getSigningKey: mockGetSigningKey,
  })),
}));

describe('McpJwksService', () => {
  const config: McpAuthConfig = {
    jwksUri: 'https://example.com/.well-known/jwks.json',
    jwksCache: true,
    jwksCacheMaxAge: 300_000,
    jwksRateLimit: false,
    jwksRequestsPerMinute: 5,
  };

  let service: McpJwksService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new McpJwksService(config);
    service.onModuleInit();
  });

  it('should create JwksClient with config options on init', () => {
    const { JwksClient } = require('jwks-rsa');
    expect(JwksClient).toHaveBeenCalledWith({
      jwksUri: 'https://example.com/.well-known/jwks.json',
      cache: true,
      cacheMaxAge: 300_000,
      rateLimit: false,
      jwksRequestsPerMinute: 5,
    });
  });

  it('should use default values when config options are not set', () => {
    const { JwksClient } = require('jwks-rsa');
    JwksClient.mockClear();

    const minimalService = new McpJwksService({ jwksUri: 'https://example.com/jwks' });
    minimalService.onModuleInit();

    expect(JwksClient).toHaveBeenCalledWith({
      jwksUri: 'https://example.com/jwks',
      cache: true,
      cacheMaxAge: 600_000,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });
  });

  it('should delegate getSigningKey to the client and return PEM', async () => {
    mockGetSigningKey.mockResolvedValue({
      getPublicKey: () => '-----BEGIN PUBLIC KEY-----\nMOCK\n-----END PUBLIC KEY-----',
    });

    const pem = await service.getSigningKey('test-kid');

    expect(mockGetSigningKey).toHaveBeenCalledWith('test-kid');
    expect(pem).toBe('-----BEGIN PUBLIC KEY-----\nMOCK\n-----END PUBLIC KEY-----');
  });

  it('should propagate errors from jwks-rsa', async () => {
    mockGetSigningKey.mockRejectedValue(new Error('SigningKeyNotFoundError'));

    await expect(service.getSigningKey('unknown-kid')).rejects.toThrow('SigningKeyNotFoundError');
  });
});
