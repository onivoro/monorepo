import { Injectable, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OAuthError, OAuthErrorCode } from '@modelcontextprotocol/server';
import type { AddressInfo } from 'net';
import * as net from 'net';
import { McpHttpModule } from './mcp-http.module';
import { McpTool } from './mcp-tool.decorator';
import type { McpModuleConfig } from './mcp-module-config';
import type { McpAuthStrategy } from './mcp-auth-strategy';
import type { McpAuthInfo } from './mcp-auth-info';

// POSTs whose body the app didn't parse, sent over a raw socket so each request carries
// exactly the headers a test names (fetch and http.request add a Content-Length).
//
// The repo runs Express 4, whose JSON parser sets `req.body` to `{}` for a request it
// doesn't parse; the SDK transports then answer it. Express 5's parser leaves `req.body`
// unset, which `bodyParser: false` reproduces here, and the module answers it itself.

@Injectable()
class BodyToolService {
  @McpTool({ name: 'whoami', description: 'Describe the call' })
  async whoami() {
    return 'me';
  }
}

@Injectable()
class BodyTestVerifier implements McpAuthStrategy {
  resolveAuth(authInfo: McpAuthInfo | undefined) {
    return authInfo;
  }

  async verifyAccessToken(token: string) {
    if (token !== 'good') {
      throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid token');
    }
    return {
      token,
      clientId: 'client',
      scopes: [],
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };
  }
}

const LEGACY_INITIALIZE = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-11-25',
    capabilities: {},
    clientInfo: { name: 'raw-client', version: '1.0.0' },
  },
});

const MODERN_TOOLS_LIST = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/list',
  params: {
    _meta: {
      'io.modelcontextprotocol/protocolVersion': '2026-07-28',
      'io.modelcontextprotocol/clientInfo': {
        name: 'raw-client',
        version: '1.0.0',
      },
      'io.modelcontextprotocol/clientCapabilities': {},
    },
  },
});

const ERAS: Array<[string, string]> = [
  ['2025-era', LEGACY_INITIALIZE],
  ['2026-07-28', MODERN_TOOLS_LIST],
];

async function startApp(
  config: Partial<McpModuleConfig>,
  bodyParser: boolean,
): Promise<{ app: any; port: number }> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      McpHttpModule.registerAndServeHttp({
        metadata: { name: 'body-e2e', version: '1.0.0' },
        ...config,
      }),
    ],
    providers: [BodyToolService, BodyTestVerifier],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false, bodyParser });
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  return { app, port };
}

interface RawResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
}

function decodeChunked(raw: string): string {
  let out = '';
  let rest = raw;
  for (;;) {
    const lineEnd = rest.indexOf('\r\n');
    const size = parseInt(rest.slice(0, lineEnd), 16);
    if (!size) return out;
    out += rest.slice(lineEnd + 2, lineEnd + 2 + size);
    rest = rest.slice(lineEnd + 2 + size + 2);
  }
}

/** Sends `POST /mcp` with exactly these headers (plus `Host` and `Connection`). */
function rawPost(
  port: number,
  headers: Record<string, string>,
  body = '',
): Promise<RawResponse> {
  const allHeaders: Record<string, string> = {
    Host: `localhost:${port}`,
    Connection: 'close',
    ...headers,
  };
  const head =
    'POST /mcp HTTP/1.1\r\n' +
    Object.entries(allHeaders)
      .map(([name, value]) => `${name}: ${value}\r\n`)
      .join('') +
    '\r\n';

  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1', () => {
      socket.end(head + body);
    });
    let raw = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => (raw += chunk));
    socket.on('error', reject);
    socket.on('close', () => {
      const split = raw.indexOf('\r\n\r\n');
      const [statusLine, ...headerLines] = raw.slice(0, split).split('\r\n');
      const responseHeaders: Record<string, string> = {};
      for (const line of headerLines) {
        const colon = line.indexOf(':');
        responseHeaders[line.slice(0, colon).toLowerCase()] = line
          .slice(colon + 1)
          .trim();
      }
      let text = raw.slice(split + 4);
      if (responseHeaders['transfer-encoding'] === 'chunked') {
        text = decodeChunked(text);
      }
      let parsed: any = text;
      try {
        parsed = JSON.parse(text);
      } catch {
        // Not JSON; keep the text.
      }
      resolve({
        status: Number(statusLine.split(' ')[1]),
        headers: responseHeaders,
        body: parsed,
      });
    });
  });
}

const JSON_ACCEPT = { Accept: 'application/json, text/event-stream' };

const PARSE_ERROR_BODY = {
  jsonrpc: '2.0',
  error: {
    code: -32700,
    message: 'Parse error: the request body is not valid JSON',
  },
  id: null,
};

/** What the SDK answers a `{}` body with: it is JSON, but not a JSON-RPC message. */
const SDK_EMPTY_OBJECT_BODY = {
  jsonrpc: '2.0',
  error: {
    code: -32600,
    message: 'Bad Request: the request body is not a valid JSON-RPC message',
  },
  id: null,
};

function expectUnsupportedMediaType(response: RawResponse) {
  expect(response.status).toBe(415);
  expect(response.body).toEqual({
    jsonrpc: '2.0',
    error: {
      code: -32000,
      message: 'Unsupported Media Type: Content-Type must be application/json',
    },
    id: null,
  });
}

describe('McpHttpModule POST bodies the app did not parse', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe.each([
    ['stateful', { session: {} }],
    ['stateless', {}],
  ] as Array<[string, Partial<McpModuleConfig>]>)(
    '%s server without body parsing (as Express 5 leaves req.body)',
    (_name, config) => {
      let app: any;
      let port: number;

      beforeAll(async () => {
        ({ app, port } = await startApp(config, false));
      });

      afterAll(async () => {
        await app?.close();
      });

      it('answers a POST with no body and no Content-Type with 415', async () => {
        expectUnsupportedMediaType(await rawPost(port, JSON_ACCEPT));
      });

      it.each(ERAS)(
        'answers a %s request sent as text/plain with 415',
        async (_era, body) => {
          expectUnsupportedMediaType(
            await rawPost(
              port,
              {
                ...JSON_ACCEPT,
                'Content-Type': 'text/plain',
                'Content-Length': String(Buffer.byteLength(body)),
              },
              body,
            ),
          );
        },
      );

      it.each([
        ['no Content-Length', {}],
        ['Content-Length: 0', { 'Content-Length': '0' }],
      ] as Array<[string, Record<string, string>]>)(
        'answers a JSON POST with no body (%s) with a 400 Parse error',
        async (_label, headers) => {
          const response = await rawPost(port, {
            ...JSON_ACCEPT,
            'Content-Type': 'application/json',
            ...headers,
          });

          expect(response.status).toBe(400);
          expect(response.body).toEqual(PARSE_ERROR_BODY);
        },
      );

      it.each(ERAS)(
        'answers a %s JSON request whose body arrived unparsed with 500 (a misconfigured app)',
        async (_era, body) => {
          const errorLog = jest
            .spyOn(Logger.prototype, 'error')
            .mockImplementation(() => undefined);

          const response = await rawPost(
            port,
            {
              ...JSON_ACCEPT,
              'Content-Type': 'application/json; charset=utf-8',
              'Content-Length': String(Buffer.byteLength(body)),
            },
            body,
          );

          expect(response.status).toBe(500);
          expect(response.body).toEqual({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message:
                'Request body not parsed. McpHttpModule requires Express platform with body-parsing middleware.',
            },
            id: null,
          });
          expect(errorLog).toHaveBeenCalledWith(
            expect.stringContaining('body unparsed'),
          );
        },
      );
    },
  );

  describe.each([
    ['stateful', { session: {} }],
    ['stateless', {}],
  ] as Array<[string, Partial<McpModuleConfig>]>)(
    '%s server with Express 4 body parsing',
    (_name, config) => {
      let app: any;
      let port: number;

      beforeAll(async () => {
        ({ app, port } = await startApp(config, true));
      });

      afterAll(async () => {
        await app?.close();
      });

      it('answers a POST with no body and no Content-Type with 415', async () => {
        expectUnsupportedMediaType(await rawPost(port, JSON_ACCEPT));
      });

      it.each(ERAS)(
        'answers a %s request sent as text/plain with 415',
        async (_era, body) => {
          expectUnsupportedMediaType(
            await rawPost(
              port,
              {
                ...JSON_ACCEPT,
                'Content-Type': 'text/plain',
                'Content-Length': String(Buffer.byteLength(body)),
              },
              body,
            ),
          );
        },
      );

      it.each([
        ['no Content-Length', {}],
        ['Content-Length: 0', { 'Content-Length': '0' }],
      ] as Array<[string, Record<string, string>]>)(
        'answers a JSON POST with no body (%s), which the parser makes {}, with a 400 Parse error',
        async (_label, headers) => {
          const response = await rawPost(port, {
            ...JSON_ACCEPT,
            'Content-Type': 'application/json',
            ...headers,
          });

          expect(response.status).toBe(400);
          expect(response.body).toEqual(PARSE_ERROR_BODY);
        },
      );

      it('leaves a {} the client did send to the SDK', async () => {
        const response = await rawPost(
          port,
          {
            ...JSON_ACCEPT,
            'Content-Type': 'application/json',
            'Content-Length': '2',
          },
          '{}',
        );

        expect(response.status).toBe(400);
        expect(response.body).toEqual(SDK_EMPTY_OBJECT_BODY);
      });

      it("leaves malformed JSON to Express's parser, which answers 400", async () => {
        const body = '{"jsonrpc":';
        const response = await rawPost(
          port,
          {
            ...JSON_ACCEPT,
            'Content-Type': 'application/json',
            'Content-Length': String(Buffer.byteLength(body)),
          },
          body,
        );

        expect(response.status).toBe(400);
      });
    },
  );

  describe('order relative to the Host, Origin and bearer checks', () => {
    let app: any;
    let port: number;

    beforeAll(async () => {
      ({ app, port } = await startApp(
        { authStrategy: BodyTestVerifier, requireBearerAuth: true },
        false,
      ));
    });

    afterAll(async () => {
      await app?.close();
    });

    it('answers a disallowed Host with 403 before looking at the body', async () => {
      const response = await rawPost(port, {
        ...JSON_ACCEPT,
        Host: 'rebound.example.com',
      });

      expect(response.status).toBe(403);
      expect(response.body.error.message).toBe(
        'Host "rebound.example.com" is not allowed',
      );
    });

    it('answers a disallowed Origin with 403 before looking at the body', async () => {
      const response = await rawPost(port, {
        ...JSON_ACCEPT,
        Origin: 'https://elsewhere.example.com',
      });

      expect(response.status).toBe(403);
    });

    it('challenges a request without a token with 401 before looking at the body', async () => {
      const response = await rawPost(port, JSON_ACCEPT);

      expect(response.status).toBe(401);
      expect(response.headers['www-authenticate']).toMatch(/^Bearer /);
    });

    it('answers an authenticated POST without a body with 415', async () => {
      expectUnsupportedMediaType(
        await rawPost(port, { ...JSON_ACCEPT, Authorization: 'Bearer good' }),
      );
    });

    it('answers an authenticated JSON POST without a body with 400', async () => {
      const response = await rawPost(port, {
        ...JSON_ACCEPT,
        Authorization: 'Bearer good',
        'Content-Type': 'application/json',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe(-32700);
    });
  });
});
