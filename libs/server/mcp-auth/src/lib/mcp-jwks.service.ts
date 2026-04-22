import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { JwksClient } from 'jwks-rsa';
import { MCP_AUTH_CONFIG } from './mcp-auth-config-token';
import type { McpAuthConfig } from './mcp-auth-config';

/**
 * Fetches and caches JWKS signing keys for JWT validation.
 * Uses `jwks-rsa` under the hood with configurable caching and rate limiting.
 */
@Injectable()
export class McpJwksService implements OnModuleInit {
  private client!: JwksClient;

  constructor(
    @Inject(MCP_AUTH_CONFIG) private readonly config: McpAuthConfig,
  ) {}

  onModuleInit(): void {
    this.client = new JwksClient({
      jwksUri: this.config.jwksUri,
      cache: this.config.jwksCache ?? true,
      cacheMaxAge: this.config.jwksCacheMaxAge ?? 600_000,
      rateLimit: this.config.jwksRateLimit ?? true,
      jwksRequestsPerMinute: this.config.jwksRequestsPerMinute ?? 10,
    });
  }

  /**
   * Fetch the PEM-encoded public key for a given key ID.
   * Results are cached by the underlying `jwks-rsa` client.
   */
  async getSigningKey(kid: string): Promise<string> {
    const key = await this.client.getSigningKey(kid);
    return key.getPublicKey();
  }
}
