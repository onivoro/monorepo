import type { OAuthServerProvider } from '@modelcontextprotocol/server-legacy/auth';
import type { McpClientIdMetadataDocumentOptions } from './mcp-client-id-metadata-document-options';

/**
 * Configuration for `McpOAuthModule`.
 *
 * The `provider` field accepts either:
 * - A class reference (`new (...args: any[]) => OAuthServerProvider`) — resolved via NestJS DI
 * - An instance (`OAuthServerProvider`) — used directly
 *
 * @deprecated Part of the deprecated `@onivoro/server-mcp-oauth`; see its README.
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

  /**
   * Whether to serve `/.well-known/oauth-protected-resource` (RFC 9728). Default: `true`.
   * Set `false` when `McpAuthModule` from `@onivoro/server-mcp-auth` serves that route,
   * so the two modules don't both register it.
   */
  serveProtectedResourceMetadata?: boolean;

  /**
   * Client ID Metadata Documents (the client registration method MCP spec 2025-11-25
   * recommends): a client whose `client_id` is an `https` URL is described by the JSON
   * document at that URL, which the server fetches instead of requiring registration.
   * Default: `true`. Pass options to tune caching and limits, or `false` to turn it off.
   * Other client IDs still go to the provider's `clientsStore`.
   */
  clientIdMetadataDocuments?: boolean | McpClientIdMetadataDocumentOptions;

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
