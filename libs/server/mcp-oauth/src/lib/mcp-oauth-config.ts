import type { OAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/provider.js';

/**
 * Configuration for `McpOAuthModule`.
 *
 * The `provider` field accepts either:
 * - A class reference (`new (...args: any[]) => OAuthServerProvider`) — resolved via NestJS DI
 * - An instance (`OAuthServerProvider`) — used directly
 */
export interface McpOAuthConfig {
  /** `OAuthServerProvider` implementation. Class reference (DI-resolved) or instance. */
  provider: OAuthServerProvider | (new (...args: any[]) => OAuthServerProvider);

  /** Issuer URL for the authorization server (required by the MCP SDK). */
  issuerUrl: string;

  /** Base URL for the auth endpoints. Defaults to `issuerUrl`. */
  baseUrl?: string;

  /** Scopes supported by this authorization server. */
  scopesSupported?: string[];

  /** Human-readable resource name for protected resource metadata. */
  resourceName?: string;

  /** Resource server URL. Defaults to `baseUrl`. */
  resourceServerUrl?: string;

  /** Service documentation URL. */
  serviceDocumentationUrl?: string;

  /** Pass-through options for the SDK's authorization handler. */
  authorizationOptions?: Record<string, unknown>;

  /** Pass-through options for the SDK's token handler. */
  tokenOptions?: Record<string, unknown>;

  /** Pass-through options for the SDK's client registration handler. */
  clientRegistrationOptions?: Record<string, unknown>;

  /** Pass-through options for the SDK's revocation handler. */
  revocationOptions?: Record<string, unknown>;
}
