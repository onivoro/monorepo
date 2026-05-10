import { Inject, Injectable, Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type { McpAuthInfo } from '@onivoro/server-mcp';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { McpAuthConfig } from './mcp-auth-config';
import type { McpCognitoAuthConfig } from './mcp-cognito-auth-config';
import { MCP_COGNITO_AUTH_CONFIG } from './mcp-cognito-auth-config-token';
import { McpJwksService } from './mcp-jwks.service';
import { McpJwtAuthStrategy } from './mcp-jwt-auth-strategy';

@Injectable()
export class McpCognitoAuthStrategy extends McpJwtAuthStrategy {
  private readonly cognitoLogger = new Logger(McpCognitoAuthStrategy.name);

  constructor(
    @Inject(MCP_COGNITO_AUTH_CONFIG) private readonly cognitoConfig: McpCognitoAuthConfig,
    jwksService: McpJwksService,
  ) {
    super(buildJwtConfig(cognitoConfig), jwksService);
  }

  async resolveAuth(authInfo: McpAuthInfo | undefined): Promise<McpAuthInfo | undefined> {
    if (!authInfo?.token) return undefined;

    try {
      const resolved = await super.resolveAuth(authInfo);
      this.assertCognitoAccessToken(authInfo.token);
      return resolved;
    } catch (error) {
      throw this.toInvalidTokenError(error);
    }
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    try {
      const verified = await super.verifyAccessToken(token);
      this.assertCognitoAccessToken(token);
      return verified;
    } catch (error) {
      throw this.toInvalidTokenError(error);
    }
  }

  private assertCognitoAccessToken(token: string): void {
    const payload = jwt.decode(token);

    if (!payload || typeof payload === 'string') {
      throw new InvalidTokenError('Invalid JWT: unable to decode token payload');
    }

    if (payload['token_use'] !== 'access') {
      throw new InvalidTokenError('Invalid JWT: expected a Cognito access token');
    }

    const actualClientId = typeof payload['client_id'] === 'string' ? payload['client_id'] : undefined;
    if (actualClientId !== this.cognitoConfig.clientId) {
      throw new InvalidTokenError(
        `Invalid JWT: unexpected client_id "${actualClientId ?? 'missing'}"`,
      );
    }
  }

  protected override toInvalidTokenError(error: unknown): InvalidTokenError {
    if (error instanceof InvalidTokenError) {
      return error;
    }

    const message = error instanceof Error ? error.message : 'Invalid access token';
    this.cognitoLogger.warn(`Cognito MCP token validation failed: ${message}`);
    return new InvalidTokenError(message);
  }
}

export function buildJwtConfig(config: McpCognitoAuthConfig): McpAuthConfig {
  const issuer = `https://cognito-idp.${config.region}.amazonaws.com/${config.userPoolId}`;

  return {
    jwksUri: `${issuer}/.well-known/jwks.json`,
    issuer,
    clientIdClaim: 'client_id',
    scopeClaim: 'scope',
    scopeFormat: 'string',
    extraClaims: config.extraClaims,
    resourceServerUrl: config.resourceServerUrl,
    authorizationServers: config.authorizationServers,
    serveProtectedResourceMetadata: config.serveProtectedResourceMetadata,
    protectedResourceMetadataMode: config.protectedResourceMetadataMode,
    resourceName: config.resourceName,
    resourceDocumentationUrl: config.resourceDocumentationUrl,
    jwksCache: config.jwksCache,
    jwksCacheMaxAge: config.jwksCacheMaxAge,
    jwksRateLimit: config.jwksRateLimit,
    jwksRequestsPerMinute: config.jwksRequestsPerMinute,
  };
}
