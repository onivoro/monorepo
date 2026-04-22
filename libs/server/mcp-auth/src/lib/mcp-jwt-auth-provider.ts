import { Inject, Injectable, Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import type { McpAuthProvider, McpAuthInfo } from '@onivoro/server-mcp';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { OAuthTokenVerifier } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import { MCP_AUTH_CONFIG } from './mcp-auth-config-token';
import type { McpAuthConfig } from './mcp-auth-config';
import { McpJwksService } from './mcp-jwks.service';

/**
 * JWT-based auth provider for MCP servers.
 *
 * Implements both:
 * - `McpAuthProvider` — plugs into the `McpToolRegistry` execution pipeline
 * - `OAuthTokenVerifier` — compatible with the SDK's `requireBearerAuth` middleware
 *
 * Validates JWT signature via JWKS, checks issuer/audience/expiry,
 * and extracts claims into `McpAuthInfo`.
 */
@Injectable()
export class McpJwtAuthProvider implements McpAuthProvider, OAuthTokenVerifier {
  private readonly logger = new Logger(McpJwtAuthProvider.name);

  constructor(
    @Inject(MCP_AUTH_CONFIG) private readonly config: McpAuthConfig,
    private readonly jwksService: McpJwksService,
  ) {}

  // -- McpAuthProvider interface --

  async resolveAuth(authInfo: McpAuthInfo | undefined): Promise<McpAuthInfo | undefined> {
    if (!authInfo?.token) return undefined;
    return this.validateAndEnrich(authInfo.token);
  }

  // -- OAuthTokenVerifier interface --

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const mcpAuth = await this.validateAndEnrich(token);
    return {
      token: mcpAuth.token,
      clientId: mcpAuth.clientId,
      scopes: mcpAuth.scopes,
      expiresAt: mcpAuth.expiresAt,
      resource: mcpAuth.resource ? new URL(mcpAuth.resource) : undefined,
      extra: mcpAuth.extra,
    };
  }

  // -- Core validation --

  private async validateAndEnrich(token: string): Promise<McpAuthInfo> {
    // 1. Decode header to get kid
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string') {
      throw new Error('Invalid JWT: unable to decode token');
    }

    const kid = decoded.header.kid;
    if (!kid) {
      throw new Error('Invalid JWT: missing kid in token header');
    }

    // 2. Fetch signing key
    const pem = await this.jwksService.getSigningKey(kid);

    // 3. Verify signature, issuer, audience, expiry
    const algorithms = this.config.algorithms ?? ['RS256'];
    const verifyOptions: jwt.VerifyOptions = {
      algorithms: algorithms as jwt.Algorithm[],
      ...(this.config.issuer && { issuer: this.config.issuer }),
      ...(this.config.audience && { audience: this.config.audience }),
    };

    const payload = jwt.verify(token, pem, verifyOptions) as jwt.JwtPayload;

    // 4. Extract clientId
    const clientIdClaim = this.config.clientIdClaim ?? 'client_id';
    const clientId = (payload[clientIdClaim] as string) ?? payload.sub ?? 'unknown';

    // 5. Extract scopes
    const scopes = this.extractScopes(payload);

    // 6. Extract expiresAt
    const expiresAt = payload.exp;

    // 7. Extract resource
    const resource = this.config.resourceIdentifier ?? undefined;

    // 8. Extract extra claims
    const extra: Record<string, unknown> = {};
    if (this.config.extraClaims) {
      for (const [claimName, extraKey] of Object.entries(this.config.extraClaims)) {
        if (payload[claimName] !== undefined) {
          extra[extraKey] = payload[claimName];
        }
      }
    }

    return {
      token,
      clientId,
      scopes,
      expiresAt,
      resource,
      ...(Object.keys(extra).length > 0 && { extra }),
    };
  }

  private extractScopes(payload: jwt.JwtPayload): string[] {
    const scopeClaim = this.config.scopeClaim ?? 'scope';
    const raw = payload[scopeClaim];

    if (raw === undefined || raw === null) return [];

    const format = this.config.scopeFormat ?? 'auto';

    if (format === 'array' || (format === 'auto' && Array.isArray(raw))) {
      return Array.isArray(raw) ? raw.map(String) : [];
    }

    if (format === 'string' || (format === 'auto' && typeof raw === 'string')) {
      return typeof raw === 'string' ? raw.split(' ').filter(Boolean) : [];
    }

    return [];
  }
}
