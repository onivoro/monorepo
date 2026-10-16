import { Injectable, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'net';
import * as net from 'net';
import { McpHttpModule } from './mcp-http.module';
import { McpTool } from './mcp-tool.decorator';
import type { McpModuleConfig } from './mcp-module-config';

// The Host check over real HTTP, on a server listening on 127.0.0.1. Requests go over a raw
// socket so each carries exactly the Host and forwarding headers a test names, as a
// DNS-rebound page (same-origin with the server) can.

@Injectable()
class HostToolService {
  @McpTool({ name: 'ping', description: 'Answer pong' })
  async ping() {
    return 'pong-from-tool';
  }
}

const MODERN_META = {
  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
  'io.modelcontextprotocol/clientInfo': {
    name: 'raw-client',
    version: '1.0.0',
  },
  'io.modelcontextprotocol/clientCapabilities': {},
};

const MODERN_TOOL_CALL = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: { name: 'ping', arguments: {}, _meta: MODERN_META },
});

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

const MODERN_HEADERS = {
  'MCP-Protocol-Version': '2026-07-28',
  'Mcp-Method': 'tools/call',
  'Mcp-Name': 'ping',
};

const MODES: Array<
  [string, Partial<McpModuleConfig>, string, Record<string, string>]
> = [
  ['stateless', {}, MODERN_TOOL_CALL, MODERN_HEADERS],
  ['stateful', { session: {} }, LEGACY_INITIALIZE, {}],
];

async function startApp(
  config: Partial<McpModuleConfig>,
): Promise<{ app: any; port: number }> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      McpHttpModule.registerAndServeHttp({
        metadata: { name: 'host-e2e', version: '1.0.0' },
        exposeErrorMessages: false,
        ...config,
      }),
    ],
    providers: [HostToolService],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  return { app, port };
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

/** Headers the request body's protocol era needs; set per describe block. */
let eraHeaders: Record<string, string> = {};

/** Sends `POST /mcp` with this `Host` and extra headers; resolves to the status and body. */
function post(
  port: number,
  host: string,
  body: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: string }> {
  const allHeaders: Record<string, string> = {
    Host: host,
    Connection: 'close',
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
    'Content-Length': String(Buffer.byteLength(body)),
    ...eraHeaders,
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
      const head = raw.slice(0, split);
      const text = raw.slice(split + 4);
      resolve({
        status: Number(head.slice(0, head.indexOf('\r\n')).split(' ')[1]),
        body: /^transfer-encoding:\s*chunked/im.test(head)
          ? decodeChunked(text)
          : text,
      });
    });
  });
}

const FORWARDING_HEADERS: Array<[string, Record<string, string>]> = [
  ['X-Forwarded-For', { 'X-Forwarded-For': '203.0.113.9' }],
  ['X-Forwarded-Host', { 'X-Forwarded-Host': 'rebound.example.com' }],
  ['Forwarded', { Forwarded: 'for=203.0.113.9;host=rebound.example.com' }],
];

describe('McpHttpModule Host check over HTTP', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  const forwardedHostWarnings = () =>
    warn.mock.calls.filter(([message]) =>
      String(message).includes('trustForwardedHosts'),
    );

  describe.each(MODES)('%s server', (_mode, modeConfig, body, headers) => {
    beforeAll(() => {
      eraHeaders = headers;
    });

    describe('trustForwardedHosts unset (the default)', () => {
      let app: any;
      let port: number;

      beforeEach(async () => {
        ({ app, port } = await startApp(modeConfig));
      });

      afterEach(async () => {
        await app?.close();
      });

      it('still lets a rebound Host with X-Forwarded-For through, and warns once', async () => {
        const first = await post(port, 'rebound.example.com', body, {
          'X-Forwarded-For': '203.0.113.9',
        });
        const second = await post(port, 'rebound.example.com', body, {
          'X-Forwarded-For': '203.0.113.9',
        });

        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        if (body === MODERN_TOOL_CALL) {
          expect(first.body).toContain('pong-from-tool');
        }
        const warnings = forwardedHostWarnings();
        expect(warnings).toHaveLength(1);
        expect(warnings[0][0]).toContain('rebound.example.com');
        expect(warnings[0][0]).toContain('DNS-rebinding');
        expect(warnings[0][0]).toContain('allowedHosts');
        expect(warnings[0][0]).toContain('next major release');
      });

      it('refuses a rebound Host without forwarding headers with 403', async () => {
        const response = await post(port, 'rebound.example.com', body);

        expect(response.status).toBe(403);
        expect(JSON.parse(response.body).error.message).toBe(
          'Host "rebound.example.com" is not allowed',
        );
      });

      it('does not warn for a loopback Host, with or without forwarding headers', async () => {
        expect((await post(port, `localhost:${port}`, body)).status).toBe(200);
        expect(
          (
            await post(port, `127.0.0.1:${port}`, body, {
              'X-Forwarded-For': '203.0.113.9',
            })
          ).status,
        ).toBe(200);

        expect(forwardedHostWarnings()).toHaveLength(0);
      });
    });

    describe('trustForwardedHosts: true', () => {
      let app: any;
      let port: number;

      beforeAll(async () => {
        ({ app, port } = await startApp({
          ...modeConfig,
          trustForwardedHosts: true,
        }));
      });

      afterAll(async () => {
        await app?.close();
      });

      it('lets a forwarded request through without warning, since it was chosen', async () => {
        const response = await post(port, 'mcp.example.com', body, {
          'X-Forwarded-For': '203.0.113.9',
        });

        expect(response.status).toBe(200);
        expect(forwardedHostWarnings()).toHaveLength(0);
      });
    });

    describe('trustForwardedHosts: false', () => {
      let app: any;
      let port: number;

      beforeAll(async () => {
        ({ app, port } = await startApp({
          ...modeConfig,
          trustForwardedHosts: false,
        }));
      });

      afterAll(async () => {
        await app?.close();
      });

      it.each(FORWARDING_HEADERS)(
        'refuses a rebound Host with %s with 403',
        async (_name, headers) => {
          const response = await post(
            port,
            'rebound.example.com',
            body,
            headers,
          );

          expect(response.status).toBe(403);
          expect(JSON.parse(response.body).error.message).toBe(
            'Host "rebound.example.com" is not allowed',
          );
          expect(forwardedHostWarnings()).toHaveLength(0);
        },
      );

      it('refuses a rebound Host without forwarding headers with 403', async () => {
        expect((await post(port, 'rebound.example.com', body)).status).toBe(
          403,
        );
      });

      it.each([
        'localhost',
        'LOCALHOST',
        'localhost:54321',
        '127.0.0.1',
        '127.0.0.1:3000',
        '[::1]',
        '[::1]:3000',
      ])('accepts the loopback Host %s', async (host) => {
        expect((await post(port, host, body)).status).toBe(200);
      });

      it('accepts a loopback Host that also carries forwarding headers', async () => {
        const response = await post(port, `localhost:${port}`, body, {
          'X-Forwarded-For': '203.0.113.9',
        });

        expect(response.status).toBe(200);
      });
    });

    describe("allowedHosts: ['mcp.example.com', 'localhost']", () => {
      let app: any;
      let port: number;

      beforeAll(async () => {
        ({ app, port } = await startApp({
          ...modeConfig,
          allowedHosts: ['mcp.example.com', 'localhost'],
        }));
      });

      afterAll(async () => {
        await app?.close();
      });

      it.each([
        'mcp.example.com',
        'MCP.Example.COM',
        'mcp.example.com:8443',
        'localhost',
        'localhost:54321',
      ])('accepts %s', async (host) => {
        expect((await post(port, host, body)).status).toBe(200);
      });

      it.each([
        'rebound.example.com',
        '127.0.0.1',
        '[::1]:3000',
        'mcp.example.com.',
        'mcp.example.com.:443',
        'mcp.example.com.rebound.example.com',
        'xmcp.example.com',
        'user@mcp.example.com',
        'rebound.example.com@mcp.example.com',
        'mcp.example.com@rebound.example.com',
        'mcp.example.com/path',
        'mcp.example.com:',
        'mcp.example.com:8443:8443',
        'mcp.example.com:99999',
        'mcp.example.com:abc',
        'localhost:3000.rebound.example.com',
      ])('refuses %s with 403', async (host) => {
        expect((await post(port, host, body)).status).toBe(403);
      });

      it.each(FORWARDING_HEADERS)(
        'does not let %s exempt a rebound Host',
        async (_name, headers) => {
          expect(
            (await post(port, 'rebound.example.com', body, headers)).status,
          ).toBe(403);
          expect(forwardedHostWarnings()).toHaveLength(0);
        },
      );
    });

    describe("allowedHosts: ['localhost:3000', '[::1]']", () => {
      let app: any;
      let port: number;

      beforeAll(async () => {
        ({ app, port } = await startApp({
          ...modeConfig,
          allowedHosts: ['localhost:3000', '[::1]'],
        }));
      });

      afterAll(async () => {
        await app?.close();
      });

      it.each(['localhost:3000', '[::1]', '[::1]:54321'])(
        'accepts %s',
        async (host) => {
          expect((await post(port, host, body)).status).toBe(200);
        },
      );

      // The Host check lets it through; past it, the 2025-era transport (@hono/node-server)
      // answers a host name with capitals and a port with its own 400.
      it('matches a port entry case-insensitively', async () => {
        expect((await post(port, 'LOCALHOST:3000', body)).status).not.toBe(403);
      });

      it.each([
        'localhost',
        'localhost:3001',
        'localhost:30000',
        'localhost:03000',
        '[::2]',
        '[::1',
        '[::1]x',
        '[localhost]',
      ])('refuses %s with 403', async (host) => {
        expect((await post(port, host, body)).status).toBe(403);
      });
    });
  });
});
