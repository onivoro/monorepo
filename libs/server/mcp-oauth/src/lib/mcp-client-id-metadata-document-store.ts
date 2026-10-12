import { Logger } from '@nestjs/common';
import * as dns from 'node:dns';
import * as https from 'node:https';
import { BlockList, isIP } from 'node:net';
import type { LookupFunction } from 'node:net';
import type { McpClientIdMetadataDocumentOptions } from './mcp-client-id-metadata-document-options';

/** The parts of an OAuth clients store this wrapper uses. */
export interface McpOAuthClientsStoreLike {
  getClient(clientId: string): Promise<any | undefined> | any | undefined;
  registerClient?(client: any): Promise<any> | any;
}

/** A fetched metadata document, before validation. */
export interface McpClientIdMetadataDocumentResponse {
  status: number;
  body: string;
  /** From the response's `Cache-Control: max-age`, when it has one. */
  maxAgeSeconds?: number;
}

const DEFAULT_CACHE_TTL_MS = 5 * 60_000;
const MAX_CACHE_TTL_MS = 24 * 60 * 60_000;
const NEGATIVE_CACHE_TTL_MS = 60_000;
const DEFAULT_MAX_BYTES = 5 * 1024;
const DEFAULT_TIMEOUT_MS = 5_000;

/** Fields a client authenticating with a shared secret would have; a metadata document can't. */
const SECRET_FIELDS = ['client_secret', 'client_secret_expires_at'];

/**
 * Whether a `client_id` is a Client ID Metadata Document URL: an `https` URL with a path,
 * and no fragment, credentials, or `.`/`..` segments. Any other `client_id` is an ordinary
 * (registered or pre-configured) client ID.
 */
export function isClientIdMetadataDocumentUrl(clientId: string): boolean {
  let url: URL;
  try {
    url = new URL(clientId);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (url.hash || url.username || url.password) return false;
  if (url.pathname === '/' || url.pathname === '') return false;
  // `new URL` resolves dot segments, so check the path as written.
  const rawPath = /^https:\/\/[^/?#]*([^?#]*)/i.exec(clientId)?.[1] ?? '';
  return !rawPath
    .split('/')
    .some(
      (segment) =>
        segment === '.' ||
        segment === '..' ||
        segment.toLowerCase() === '%2e' ||
        segment.toLowerCase() === '%2e%2e',
    );
}

const PRIVATE_NETWORKS = (() => {
  const list = new BlockList();
  for (const [network, prefix] of [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4],
  ] as const) {
    list.addSubnet(network, prefix, 'ipv4');
  }
  for (const [network, prefix] of [
    ['::', 128],
    ['::1', 128],
    ['fc00::', 7],
    ['fe80::', 10],
    ['ff00::', 8],
  ] as const) {
    list.addSubnet(network, prefix, 'ipv6');
  }
  return list;
})();

/**
 * Whether an address is loopback, private, link-local, or otherwise not on the public
 * internet. IPv4-mapped IPv6 addresses are checked as IPv4.
 */
export function isPrivateNetworkAddress(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return PRIVATE_NETWORKS.check(mapped[1], 'ipv4');
  const family = isIP(address);
  if (family === 4) return PRIVATE_NETWORKS.check(address, 'ipv4');
  if (family === 6) return PRIVATE_NETWORKS.check(address, 'ipv6');
  return true;
}

/**
 * A DNS lookup that refuses private addresses. The connection uses the address this
 * returns, so a host name can't be re-pointed between the check and the request.
 */
const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, '', 0);
    const list = addresses as dns.LookupAddress[];
    const blocked = list.find(({ address }) =>
      isPrivateNetworkAddress(address),
    );
    if (!list.length || blocked) {
      return callback(
        new Error(
          `Refusing to fetch a client metadata document from ${hostname}: it resolves to a non-public address`,
        ),
        '',
        0,
      );
    }
    if ((options as dns.LookupOptions).all) {
      return (callback as any)(null, list);
    }
    callback(null, list[0].address, list[0].family);
  });
};

function maxAgeSeconds(cacheControl: string | undefined): number | undefined {
  if (!cacheControl) return undefined;
  if (/\bno-store\b|\bno-cache\b/i.test(cacheControl)) return 0;
  const match = /\bmax-age=(\d+)/i.exec(cacheControl);
  return match ? Number(match[1]) : undefined;
}

/**
 * Fetches a metadata document over HTTPS: no redirects, a size and time limit, and (unless
 * `allowPrivateNetwork`) only from public addresses, so a client ID can't point the
 * authorization server at its own network.
 */
export function fetchClientIdMetadataDocument(
  url: URL,
  options: {
    maxBytes: number;
    timeoutMs: number;
    allowPrivateNetwork: boolean;
  },
): Promise<McpClientIdMetadataDocumentResponse> {
  return new Promise((resolve, reject) => {
    if (
      !options.allowPrivateNetwork &&
      isIP(url.hostname.replace(/^\[|\]$/g, '')) &&
      isPrivateNetworkAddress(url.hostname.replace(/^\[|\]$/g, ''))
    ) {
      reject(
        new Error(
          `Refusing to fetch a client metadata document from ${url.hostname}: it is a non-public address`,
        ),
      );
      return;
    }

    const request = https.get(
      url,
      {
        headers: { accept: 'application/json' },
        timeout: options.timeoutMs,
        ...(!options.allowPrivateNetwork && { lookup: publicOnlyLookup }),
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > options.maxBytes) {
            request.destroy(
              new Error(
                `Client metadata document at ${url.href} is larger than ${options.maxBytes} bytes`,
              ),
            );
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
            maxAgeSeconds: maxAgeSeconds(response.headers['cache-control']),
          }),
        );
        response.on('error', reject);
      },
    );
    request.on('timeout', () =>
      request.destroy(
        new Error(
          `Timed out fetching the client metadata document at ${url.href}`,
        ),
      ),
    );
    request.on('error', reject);
  });
}

/**
 * The client a metadata document describes, or an error saying why it can't be used.
 * Clients identified this way are public clients: they hold no secret, so they
 * authenticate to the token endpoint with `none` (and PKCE).
 */
export function parseClientIdMetadataDocument(
  clientId: string,
  body: string,
): { client: Record<string, unknown> } | { error: string } {
  let document: unknown;
  try {
    document = JSON.parse(body);
  } catch {
    return { error: 'the document is not JSON' };
  }
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return { error: 'the document is not a JSON object' };
  }
  const metadata = document as Record<string, unknown>;

  if (metadata['client_id'] !== clientId) {
    return {
      error: 'its client_id does not match the URL it was fetched from',
    };
  }
  const redirectUris = metadata['redirect_uris'];
  if (
    !Array.isArray(redirectUris) ||
    redirectUris.length === 0 ||
    !redirectUris.every((uri) => typeof uri === 'string')
  ) {
    return { error: 'it has no redirect_uris' };
  }
  for (const uri of redirectUris as string[]) {
    try {
      new URL(uri);
    } catch {
      return { error: `redirect_uri "${uri}" is not a URL` };
    }
  }
  if (SECRET_FIELDS.some((field) => field in metadata)) {
    return { error: 'it contains a client secret' };
  }
  const authMethod = metadata['token_endpoint_auth_method'];
  if (authMethod !== undefined && authMethod !== 'none') {
    return {
      error: `token_endpoint_auth_method "${String(authMethod)}" is not supported; use "none"`,
    };
  }

  return {
    client: {
      ...metadata,
      client_id: clientId,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: 'none',
    },
  };
}

interface CacheEntry {
  client?: Record<string, unknown>;
  expiresAt: number;
}

/**
 * An OAuth clients store that also recognizes Client ID Metadata Documents (the client
 * registration method MCP spec 2025-11-25 recommends): a `client_id` that is an `https`
 * URL is resolved by fetching the client's metadata from that URL. Any other `client_id`
 * goes to the wrapped store, which also keeps handling dynamic registration if it does.
 *
 * Documents are cached for their `Cache-Control: max-age` (capped at a day), or
 * `cacheTtlMs` when they don't say; documents that fail are remembered for a minute.
 *
 * @deprecated Part of the deprecated `@onivoro/server-mcp-oauth`; see its README.
 */
export class McpClientIdMetadataDocumentStore {
  private readonly logger = new Logger(McpClientIdMetadataDocumentStore.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<
    string,
    Promise<Record<string, unknown> | undefined>
  >();
  /** Present only when the wrapped store registers clients, so `/register` stays off otherwise. */
  readonly registerClient?: (client: any) => Promise<any>;

  constructor(
    private readonly inner: McpOAuthClientsStoreLike | undefined,
    private readonly options: McpClientIdMetadataDocumentOptions = {},
  ) {
    if (inner?.registerClient) {
      const register = inner.registerClient.bind(inner);
      this.registerClient = async (client) => register(client);
    }
  }

  async getClient(clientId: string): Promise<any | undefined> {
    if (!isClientIdMetadataDocumentUrl(clientId)) {
      return this.inner?.getClient(clientId);
    }

    const cached = this.cache.get(clientId);
    if (cached && cached.expiresAt > Date.now()) return cached.client;

    let pending = this.inFlight.get(clientId);
    if (!pending) {
      pending = this.resolve(clientId).finally(() =>
        this.inFlight.delete(clientId),
      );
      this.inFlight.set(clientId, pending);
    }
    return pending;
  }

  private async resolve(
    clientId: string,
  ): Promise<Record<string, unknown> | undefined> {
    const limits = {
      maxBytes: this.options.maxBytes ?? DEFAULT_MAX_BYTES,
      timeoutMs: this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      allowPrivateNetwork: this.options.allowPrivateNetwork ?? false,
    };
    const fetchDocument =
      this.options.fetchDocument ?? fetchClientIdMetadataDocument;

    try {
      const response = await fetchDocument(new URL(clientId), limits);
      if (response.status !== 200) {
        return this.reject(clientId, `the URL answered ${response.status}`);
      }
      if (Buffer.byteLength(response.body) > limits.maxBytes) {
        return this.reject(
          clientId,
          `the document is larger than ${limits.maxBytes} bytes`,
        );
      }

      const parsed = parseClientIdMetadataDocument(clientId, response.body);
      if ('error' in parsed) return this.reject(clientId, parsed.error);

      const ttlMs =
        response.maxAgeSeconds !== undefined
          ? Math.min(response.maxAgeSeconds * 1000, MAX_CACHE_TTL_MS)
          : (this.options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS);
      this.cache.set(clientId, {
        client: parsed.client,
        expiresAt: Date.now() + ttlMs,
      });
      return parsed.client;
    } catch (error) {
      return this.reject(
        clientId,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private reject(clientId: string, reason: string): undefined {
    this.logger.warn(
      `Rejected client metadata document ${clientId}: ${reason}`,
    );
    this.cache.set(clientId, { expiresAt: Date.now() + NEGATIVE_CACHE_TTL_MS });
    return undefined;
  }
}
