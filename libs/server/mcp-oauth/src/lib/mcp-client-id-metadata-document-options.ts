import type { McpClientIdMetadataDocumentResponse } from './mcp-client-id-metadata-document-store';

/** Options for Client ID Metadata Document support in `McpOAuthModule`. */
export interface McpClientIdMetadataDocumentOptions {
  /** How long to cache a document whose response has no `Cache-Control: max-age`. Default: 5 minutes. */
  cacheTtlMs?: number;
  /** Largest document accepted, in bytes. Default: 5120. */
  maxBytes?: number;
  /** How long to wait for a document. Default: 5000 ms. */
  timeoutMs?: number;
  /**
   * Allow documents on loopback, private and link-local addresses. Default: `false`, so a
   * client ID can't make the authorization server send requests into its own network.
   * Only for development and tests.
   */
  allowPrivateNetwork?: boolean;
  /** Replaces the HTTPS fetch, e.g. in tests. Receives the limits above. */
  fetchDocument?: (
    url: URL,
    limits: {
      maxBytes: number;
      timeoutMs: number;
      allowPrivateNetwork: boolean;
    },
  ) => Promise<McpClientIdMetadataDocumentResponse>;
}
