export interface McpAuthConfig {
  /** JWKS endpoint URL for fetching signing keys. */
  jwksUri: string;

  /** Expected JWT issuer (`iss` claim). When set, tokens with a different issuer are rejected. */
  issuer?: string;

  /** Expected audience (`aud` claim). When set, tokens with a different audience are rejected. */
  audience?: string;

  /** Accepted signing algorithms. Default: `['RS256']`. */
  algorithms?: string[];

  /**
   * JWT claim to extract as `clientId`. Default: `'client_id'`.
   *
   * Common values by provider:
   * - **Cognito**: `'client_id'`
   * - **Auth0**: `'azp'`
   * - **Entra ID**: `'appid'`
   */
  clientIdClaim?: string;

  /**
   * JWT claim to extract scopes from. Default: `'scope'`.
   *
   * Common values by provider:
   * - **Cognito / OIDC**: `'scope'` (space-delimited string)
   * - **Auth0**: `'permissions'` (JSON array)
   */
  scopeClaim?: string;

  /**
   * Format of the scope claim value.
   * - `'string'`: space-delimited string (OIDC `scope` claim)
   * - `'array'`: JSON array (Auth0 `permissions`)
   * - `'auto'`: detect automatically based on the claim value type
   *
   * Default: `'auto'`.
   */
  scopeFormat?: 'string' | 'array' | 'auto';

  /**
   * Additional JWT claims to extract into `McpAuthInfo.extra`.
   *
   * Keys are JWT claim names; values are the key under `extra`.
   *
   * @example `{ 'custom:tenant': 'tenantId', 'sub': 'userId' }`
   */
  extraClaims?: Record<string, string>;

  /** RFC 8707 resource indicator. When set, the provider checks the token's `aud` matches. */
  resourceIdentifier?: string;

  // --- Protected Resource Metadata (RFC 9728) ---

  /** Base URL of this MCP server. Used as the `resource` field in PRM. Required when `serveProtectedResourceMetadata` is `true`. */
  resourceServerUrl?: string;

  /** OAuth 2.0 authorization server URLs that protect this resource. */
  authorizationServers?: string[];

  /** Whether to serve the `/.well-known/oauth-protected-resource` endpoint. Default: `true`. */
  serveProtectedResourceMetadata?: boolean;

  /** Human-readable resource name for the PRM response. */
  resourceName?: string;

  /** Documentation URL for the PRM response. */
  resourceDocumentationUrl?: string;

  // --- JWKS client options (passed to jwks-rsa) ---

  /** Enable JWKS response caching. Default: `true`. */
  jwksCache?: boolean;

  /** JWKS cache max age in milliseconds. Default: `600_000` (10 minutes). */
  jwksCacheMaxAge?: number;

  /** Enable JWKS rate limiting. Default: `true`. */
  jwksRateLimit?: boolean;

  /** Maximum JWKS requests per minute when rate limiting is enabled. Default: `10`. */
  jwksRequestsPerMinute?: number;
}

/**
 * Async factory options for `McpAuthModule.registerAsync()`.
 */
export interface McpAuthAsyncOptions {
  imports?: any[];
  inject?: any[];
  useFactory: (...args: any[]) => McpAuthConfig | Promise<McpAuthConfig>;
}
