import { Inject, Injectable, Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type { McpAuthInfo } from '@onivoro/server-mcp';
import type { McpAuthConfig } from './mcp-auth-config';
import type { McpCognitoAuthConfig } from './mcp-cognito-auth-config';
import { MCP_COGNITO_AUTH_CONFIG } from './mcp-cognito-auth-config-token';
import { McpJwksService } from './mcp-jwks.service';
import { McpJwtAuthStrategy } from './mcp-jwt-auth-strategy';

@Injectable()
export class McpCognitoAuthStrategy extends McpJwtAuthStrategy {
  private readonly cognitoLogger = new Logger(McpCognitoAuthStrategy.name);

  constructor(
    @Inject(MCP_COGNITO_AUTH_CONFIG)
    private readonly cognitoConfig: McpCognitoAuthConfig,
    jwksService: McpJwksService,
  ) {
    super(buildJwtConfig(cognitoConfig), jwksService);
  }

  async resolveAuth(
    authInfo: McpAuthInfo | undefined,
  ): Promise<McpAuthInfo | undefined> {
    if (!authInfo?.token) return undefined;

    try {
      const resolved = await super.resolveAuth(authInfo);
      this.assertCognitoAccessToken(authInfo.token);
      return resolved;
    } catch (error) {
      throw this.toInvalidTokenError(error);
    }
  }

  /**
   * Verifies an access token for an in-process caller, such as an agentic loop
   * acting for a signed-in web app user. Same checks as the MCP route
   * (signature, issuer, expiry, `token_use: 'access'`), but the token may come
   * from `clientId` or any of `inProcessClientIds`. Not used by the MCP route.
   *
   * Throws `InvalidTokenError` when the token is rejected.
   */
  async verifyInProcessAccessToken(token: string): Promise<McpAuthInfo> {
    try {
      // The JWT checks without this class's single-client check.
      const resolved = await super.resolveAuth({
        token,
        clientId: '',
        scopes: [],
      });
      if (!resolved) {
        throw new InvalidTokenError('Invalid access token');
      }
      this.assertCognitoAccessToken(token, [
        this.cognitoConfig.clientId,
        ...(this.cognitoConfig.inProcessClientIds ?? []),
      ]);
      return resolved;
    } catch (error) {
      throw this.toInvalidTokenError(error);
    }
  }

  private assertCognitoAccessToken(
    token: string,
    acceptedClientIds: string[] = [this.cognitoConfig.clientId],
  ): void {
    const payload = jwt.decode(token);

    if (!payload || typeof payload === 'string') {
      throw new InvalidTokenError(
        'Invalid JWT: unable to decode token payload',
      );
    }

    if (payload['token_use'] !== 'access') {
      throw new InvalidTokenError(
        'Invalid JWT: expected a Cognito access token',
      );
    }

    const actualClientId =
      typeof payload['client_id'] === 'string'
        ? payload['client_id']
        : undefined;
    if (!actualClientId || !acceptedClientIds.includes(actualClientId)) {
      throw new InvalidTokenError(
        `Invalid JWT: unexpected client_id "${actualClientId ?? 'missing'}"`,
      );
    }
  }

  protected override toInvalidTokenError(error: unknown): InvalidTokenError {
    if (error instanceof InvalidTokenError) {
      return error;
    }

    const message =
      error instanceof Error ? error.message : 'Invalid access token';
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
