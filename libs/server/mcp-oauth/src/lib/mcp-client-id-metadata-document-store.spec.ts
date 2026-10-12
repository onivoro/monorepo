import { Logger } from '@nestjs/common';
import {
  fetchClientIdMetadataDocument,
  isClientIdMetadataDocumentUrl,
  isPrivateNetworkAddress,
  McpClientIdMetadataDocumentStore,
  parseClientIdMetadataDocument,
} from './mcp-client-id-metadata-document-store';

const CLIENT_ID = 'https://client.example.com/oauth/metadata.json';

function document(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    client_id: CLIENT_ID,
    client_name: 'Example Client',
    redirect_uris: ['http://localhost:3118/callback'],
    ...overrides,
  });
}

describe('isClientIdMetadataDocumentUrl', () => {
  it.each([
    CLIENT_ID,
    'https://client.example.com:8443/meta',
    'https://client.example.com/meta?v=1',
  ])('accepts %s', (clientId) => {
    expect(isClientIdMetadataDocumentUrl(clientId)).toBe(true);
  });

  it.each([
    'opaque-client-id',
    'http://client.example.com/meta',
    'https://client.example.com',
    'https://client.example.com/',
    'https://client.example.com/meta#frag',
    'https://user:pass@client.example.com/meta',
    'https://client.example.com/a/../meta',
    'https://client.example.com/./meta',
    'https://client.example.com/a/%2E%2E/meta',
  ])('rejects %s', (clientId) => {
    expect(isClientIdMetadataDocumentUrl(clientId)).toBe(false);
  });
});

describe('isPrivateNetworkAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.20.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    'not-an-ip',
  ])('treats %s as private', (address) => {
    expect(isPrivateNetworkAddress(address)).toBe(true);
  });

  it.each(['93.184.216.34', '2606:4700::1111', '::ffff:93.184.216.34'])(
    'treats %s as public',
    (address) => {
      expect(isPrivateNetworkAddress(address)).toBe(false);
    },
  );
});

describe('fetchClientIdMetadataDocument', () => {
  it('refuses a literal private address without connecting', async () => {
    await expect(
      fetchClientIdMetadataDocument(new URL('https://127.0.0.1/meta'), {
        maxBytes: 1024,
        timeoutMs: 1000,
        allowPrivateNetwork: false,
      }),
    ).rejects.toThrow(/non-public address/);
  });

  it('refuses a host name that resolves to a private address', async () => {
    await expect(
      fetchClientIdMetadataDocument(new URL('https://localhost/meta'), {
        maxBytes: 1024,
        timeoutMs: 1000,
        allowPrivateNetwork: false,
      }),
    ).rejects.toThrow(/non-public address/);
  });
});

describe('parseClientIdMetadataDocument', () => {
  it('describes a public client', () => {
    expect(parseClientIdMetadataDocument(CLIENT_ID, document())).toEqual({
      client: {
        client_id: CLIENT_ID,
        client_name: 'Example Client',
        redirect_uris: ['http://localhost:3118/callback'],
        token_endpoint_auth_method: 'none',
      },
    });
  });

  it.each([
    ['not JSON', '{', /not JSON/],
    ['not an object', '[]', /not a JSON object/],
    [
      'a different client_id',
      document({ client_id: 'https://other.example.com/meta' }),
      /does not match/,
    ],
    ['no redirect_uris', document({ redirect_uris: [] }), /no redirect_uris/],
    [
      'an invalid redirect_uri',
      document({ redirect_uris: ['not a url'] }),
      /is not a URL/,
    ],
    ['a client secret', document({ client_secret: 's' }), /client secret/],
    [
      'a secret-based auth method',
      document({ token_endpoint_auth_method: 'client_secret_post' }),
      /not supported/,
    ],
  ])('rejects a document with %s', (_case, body, error) => {
    const result = parseClientIdMetadataDocument(CLIENT_ID, body as string);
    expect('error' in result && result.error).toMatch(error as RegExp);
  });
});

describe(McpClientIdMetadataDocumentStore.name, () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('passes other client IDs to the wrapped store', async () => {
    const inner = {
      getClient: jest.fn().mockResolvedValue({ client_id: 'x' }),
    };
    const fetchDocument = jest.fn();
    const store = new McpClientIdMetadataDocumentStore(inner, {
      fetchDocument,
    });

    await expect(store.getClient('x')).resolves.toEqual({ client_id: 'x' });
    expect(fetchDocument).not.toHaveBeenCalled();
  });

  it('only offers registration when the wrapped store does', () => {
    expect(
      new McpClientIdMetadataDocumentStore({ getClient: jest.fn() })
        .registerClient,
    ).toBeUndefined();
    expect(
      new McpClientIdMetadataDocumentStore({
        getClient: jest.fn(),
        registerClient: jest.fn(),
      }).registerClient,
    ).toBeInstanceOf(Function);
  });

  it('fetches, caches, and shares concurrent lookups of a document', async () => {
    const fetchDocument = jest
      .fn()
      .mockResolvedValue({ status: 200, body: document() });
    const store = new McpClientIdMetadataDocumentStore(undefined, {
      fetchDocument,
    });

    const [first, second] = await Promise.all([
      store.getClient(CLIENT_ID),
      store.getClient(CLIENT_ID),
    ]);
    const third = await store.getClient(CLIENT_ID);

    expect(first).toMatchObject({ client_id: CLIENT_ID });
    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(fetchDocument).toHaveBeenCalledTimes(1);
    expect(fetchDocument).toHaveBeenCalledWith(new URL(CLIENT_ID), {
      maxBytes: 5120,
      timeoutMs: 5000,
      allowPrivateNetwork: false,
    });
  });

  it('honors max-age, including zero', async () => {
    const fetchDocument = jest
      .fn()
      .mockResolvedValue({ status: 200, body: document(), maxAgeSeconds: 0 });
    const store = new McpClientIdMetadataDocumentStore(undefined, {
      fetchDocument,
    });

    await store.getClient(CLIENT_ID);
    await new Promise((resolve) => setTimeout(resolve, 2));
    await store.getClient(CLIENT_ID);

    expect(fetchDocument).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['a non-200 answer', { status: 404, body: '' }],
    [
      'an oversized document',
      { status: 200, body: document({ pad: 'x'.repeat(6000) }) },
    ],
    [
      'an invalid document',
      { status: 200, body: document({ client_id: 'https://evil.example/x' }) },
    ],
  ])('rejects %s and remembers the failure', async (_case, response) => {
    const fetchDocument = jest.fn().mockResolvedValue(response);
    const store = new McpClientIdMetadataDocumentStore(undefined, {
      fetchDocument,
    });

    await expect(store.getClient(CLIENT_ID)).resolves.toBeUndefined();
    await expect(store.getClient(CLIENT_ID)).resolves.toBeUndefined();
    expect(fetchDocument).toHaveBeenCalledTimes(1);
  });

  it('treats a failed fetch as an unknown client', async () => {
    const store = new McpClientIdMetadataDocumentStore(undefined, {
      fetchDocument: jest.fn().mockRejectedValue(new Error('timed out')),
    });

    await expect(store.getClient(CLIENT_ID)).resolves.toBeUndefined();
  });
});
