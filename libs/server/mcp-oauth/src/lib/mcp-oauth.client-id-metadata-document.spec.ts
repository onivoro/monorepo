import { Test } from '@nestjs/testing';
import { AddressInfo } from 'net';
import { McpOAuthModule } from './mcp-oauth.module';

// Runs the MCP SDK's real auth router (unlike the routing specs, which mock it).

const CLIENT_ID = 'https://client.example.com/oauth/metadata.json';
const REDIRECT_URI = 'http://localhost:3118/callback';

function provider() {
  return {
    clientsStore: {
      getClient: jest.fn(async (clientId: string) =>
        clientId === 'registered'
          ? { client_id: 'registered', redirect_uris: [REDIRECT_URI] }
          : undefined,
      ),
    },
    authorize: jest.fn(async (client: any, _params: any, res: any) => {
      res.status(200).json({ authorizedClient: client });
    }),
    challengeForAuthorizationCode: jest.fn(),
    exchangeAuthorizationCode: jest.fn(),
    exchangeRefreshToken: jest.fn(),
    verifyAccessToken: jest.fn(),
  };
}

const fetchDocument = jest.fn(async () => ({
  status: 200,
  body: JSON.stringify({
    client_id: CLIENT_ID,
    client_name: 'Example Client',
    redirect_uris: [REDIRECT_URI],
  }),
}));

async function start(config: Record<string, unknown>) {
  const moduleRef = await Test.createTestingModule({
    imports: [
      McpOAuthModule.configure({
        issuerUrl: 'http://localhost/',
        ...config,
      } as any),
    ],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  return { app, baseUrl: `http://127.0.0.1:${port}` };
}

function authorizeUrl(baseUrl: string, clientId: string) {
  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    code_challenge: 'x'.repeat(43),
    code_challenge_method: 'S256',
  });
  return `${baseUrl}/authorize?${query}`;
}

describe('McpOAuthModule Client ID Metadata Documents', () => {
  let app: any;

  afterEach(async () => {
    await app?.close();
    fetchDocument.mockClear();
  });

  it('advertises support and authorizes a client described by its document', async () => {
    const oauthProvider = provider();
    let baseUrl: string;
    ({ app, baseUrl } = await start({
      provider: oauthProvider,
      clientIdMetadataDocuments: { fetchDocument },
    }));

    const metadata = await (
      await fetch(`${baseUrl}/.well-known/oauth-authorization-server`)
    ).json();
    const response = await fetch(authorizeUrl(baseUrl, CLIENT_ID));

    expect(metadata).toEqual(
      expect.objectContaining({
        issuer: 'http://localhost/',
        client_id_metadata_document_supported: true,
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      authorizedClient: expect.objectContaining({
        client_id: CLIENT_ID,
        redirect_uris: [REDIRECT_URI],
        token_endpoint_auth_method: 'none',
      }),
    });
    expect(fetchDocument).toHaveBeenCalledWith(
      new URL(CLIENT_ID),
      expect.any(Object),
    );
    expect(oauthProvider.clientsStore.getClient).not.toHaveBeenCalled();
  });

  it('still authorizes registered clients through the provider store', async () => {
    const oauthProvider = provider();
    let baseUrl: string;
    ({ app, baseUrl } = await start({
      provider: oauthProvider,
      clientIdMetadataDocuments: { fetchDocument },
    }));

    const response = await fetch(authorizeUrl(baseUrl, 'registered'));

    expect(response.status).toBe(200);
    expect(oauthProvider.clientsStore.getClient).toHaveBeenCalledWith(
      'registered',
    );
    expect(fetchDocument).not.toHaveBeenCalled();
  });

  it('rejects a redirect_uri the document does not list', async () => {
    let baseUrl: string;
    ({ app, baseUrl } = await start({
      provider: provider(),
      clientIdMetadataDocuments: { fetchDocument },
    }));

    const url = new URL(authorizeUrl(baseUrl, CLIENT_ID));
    url.searchParams.set('redirect_uri', 'https://evil.example.com/cb');
    const response = await fetch(url);

    expect(response.status).toBe(400);
  });

  it('can be turned off', async () => {
    let baseUrl: string;
    ({ app, baseUrl } = await start({
      provider: provider(),
      clientIdMetadataDocuments: false,
    }));

    const metadata = await (
      await fetch(`${baseUrl}/.well-known/oauth-authorization-server`)
    ).json();
    const response = await fetch(authorizeUrl(baseUrl, CLIENT_ID));

    expect(metadata).not.toHaveProperty(
      'client_id_metadata_document_supported',
    );
    expect(response.status).toBe(400);
    expect(fetchDocument).not.toHaveBeenCalled();
  });
});
