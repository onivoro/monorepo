/**
 * @jest-environment node
 */
// Node supplies fetch/Request/Response/Headers; jsdom does not.
import {
  AgenticFetchError,
  createAgenticChatClient,
  isAgenticFetchStatus,
} from './agentic-chat-client';

const base = 'https://app.example.com';

type FetchMock = jest.Mock<Promise<Response>, [Request]>;

function respond(status: number, body?: unknown, statusText = ''): Response {
  if (status === 204) return new Response(null, { status });
  return new Response(
    body === undefined
      ? ''
      : typeof body === 'string'
        ? body
        : JSON.stringify(body),
    { status, statusText },
  );
}

let fetchMock: FetchMock;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  fetchMock = jest.fn(async (_request: Request) => respond(200, { ok: true }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

const lastRequest = () => fetchMock.mock.calls.at(-1)![0];

describe('createAgenticChatClient URLs', () => {
  it.each([
    [base, `${base}/api`],
    [`${base}/`, `${base}/api`],
    [`${base}/api`, `${base}/api`],
    [`${base}/api/`, `${base}/api`],
    [`${base}/prefix`, `${base}/prefix/api`],
  ])('normalises apiBaseUrl %p to %p', async (apiBaseUrl, expected) => {
    const client = createAgenticChatClient({ apiBaseUrl });
    await client.getAgenticConversation('c1');
    expect(lastRequest().url).toBe(`${expected}/agentic-chat/conversations/c1`);
  });

  it('resolves a function apiBaseUrl on every call', async () => {
    let current = 'https://one.example.com';
    const client = createAgenticChatClient({ apiBaseUrl: () => current });
    await client.listAgenticMessages('c1');
    expect(lastRequest().url).toBe(
      'https://one.example.com/api/agentic-chat/conversations/c1/messages',
    );
    current = 'https://two.example.com';
    expect(client.agenticMessagesUrl('a/b')).toBe(
      'https://two.example.com/api/agentic-chat/conversations/a%2Fb/messages',
    );
  });

  it('resolves a relative apiBaseUrl against the page origin', async () => {
    const g = globalThis as { location?: unknown };
    g.location = { origin: base };
    try {
      const client = createAgenticChatClient({ apiBaseUrl: '' });
      await client.listAgenticMessages('c1');
      expect(lastRequest().url).toBe(
        `${base}/api/agentic-chat/conversations/c1/messages`,
      );
    } finally {
      delete g.location;
    }
  });
});

describe('agenticFetch', () => {
  it('sends GET with no-store cache and configured credentials', async () => {
    const client = createAgenticChatClient({
      apiBaseUrl: base,
      credentials: 'include',
    });
    const result = await client.agenticFetch(`${base}/api/anything`);
    const request = lastRequest();
    expect(result).toEqual({ ok: true });
    expect(request.method).toBe('GET');
    expect(request.cache).toBe('no-store');
    expect(request.credentials).toBe('include');
    expect(request.headers.has('Content-Type')).toBe(false);
  });

  it('accepts relative paths under the API base', async () => {
    const client = createAgenticChatClient({ apiBaseUrl: base });
    await client.agenticFetch('/api/agentic-chat/x');
    expect(lastRequest().url).toBe(`${base}/api/agentic-chat/x`);
  });

  it.each([
    'https://evil.example.com/api/agentic-chat/conversations',
    `${base}/other/path`,
    `${base}/apiextra/x`,
    `${base}/api`,
  ])('blocks untrusted URL %p without fetching', async (url) => {
    const client = createAgenticChatClient({ apiBaseUrl: base });
    const error = (await client
      .agenticFetch(url)
      .catch((e: AgenticFetchError) => e)) as AgenticFetchError;
    expect(error).toBeInstanceOf(AgenticFetchError);
    expect(error.status).toBe(0);
    expect(error.message).toBe('Blocked untrusted iGENTiC API URL.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('merges auth headers on every request and send headers on POST only', async () => {
    const authHeaders = jest.fn(async () => ({ Authorization: 'Bearer t' }));
    const extraSendHeaders = jest.fn(() => ({ 'X-Mcp': 'm' }));
    const client = createAgenticChatClient({
      apiBaseUrl: base,
      authHeaders,
      extraSendHeaders,
    });

    await client.listAgenticMessages('c1');
    expect(lastRequest().headers.get('Authorization')).toBe('Bearer t');
    expect(lastRequest().headers.has('X-Mcp')).toBe(false);
    expect(extraSendHeaders).not.toHaveBeenCalled();

    await client.agenticFetch(`${base}/api/x`, {
      method: 'post',
      body: 'raw',
      headers: { 'Content-Type': 'text/plain', 'X-Keep': '1' },
    });
    const request = lastRequest();
    expect(request.method).toBe('POST');
    expect(request.headers.get('Authorization')).toBe('Bearer t');
    expect(request.headers.get('X-Mcp')).toBe('m');
    expect(request.headers.get('X-Keep')).toBe('1');
    expect(request.headers.get('Content-Type')).toBe('text/plain');
    expect(authHeaders).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'post' }),
    );
  });

  it('defaults Content-Type to JSON when a body is sent', async () => {
    const client = createAgenticChatClient({ apiBaseUrl: base });
    await client.createAgenticConversation({ title: 'T' });
    const request = lastRequest();
    expect(request.headers.get('Content-Type')).toBe('application/json');
    expect(await request.json()).toEqual({ title: 'T' });
  });

  it('returns undefined for 204 responses', async () => {
    fetchMock.mockResolvedValueOnce(respond(204));
    const client = createAgenticChatClient({ apiBaseUrl: base });
    await expect(
      client.deleteAgenticConversation('c1'),
    ).resolves.toBeUndefined();
    expect(lastRequest().method).toBe('DELETE');
  });

  it.each([
    [respond(400, { message: 'Bad thing' }), 'Bad thing'],
    [respond(400, { message: 42 }), '{"message":42}'],
    [respond(500, 'plain failure'), 'plain failure'],
    [respond(503, undefined, 'Service Unavailable'), '503 Service Unavailable'],
    [respond(502), '502'],
  ])(
    'maps error response to AgenticFetchError (%#)',
    async (response, message) => {
      fetchMock.mockResolvedValueOnce(response);
      const client = createAgenticChatClient({ apiBaseUrl: base });
      const error = (await client
        .getAgenticConversation('c1')
        .catch((e: AgenticFetchError) => e)) as AgenticFetchError;
      expect(error).toBeInstanceOf(AgenticFetchError);
      expect(error.name).toBe('AgenticFetchError');
      expect(error.message).toBe(message);
      expect(error.status).toBe(response.status);
    },
  );
});

describe('client endpoints', () => {
  const client = () => createAgenticChatClient({ apiBaseUrl: base });
  const api = `${base}/api/agentic-chat`;

  it('createAgenticConversation defaults to an empty body', async () => {
    await client().createAgenticConversation();
    expect(lastRequest().url).toBe(`${api}/conversations`);
    expect(await lastRequest().json()).toEqual({});
  });

  it('listAgenticConversations builds the query string', async () => {
    await client().listAgenticConversations();
    expect(lastRequest().url).toBe(`${api}/conversations`);

    await client().listAgenticConversations({
      limit: 5,
      search: 'a b',
      resourceId: 'r1',
      resourceType: 'patient',
    });
    const url = new URL(lastRequest().url);
    expect(url.pathname).toBe('/api/agentic-chat/conversations');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      limit: '5',
      q: 'a b',
      resourceId: 'r1',
      resourceType: 'patient',
    });
  });

  it('listAgenticPrompts builds the query string', async () => {
    await client().listAgenticPrompts();
    expect(lastRequest().url).toBe(`${api}/prompts`);
    await client().listAgenticPrompts({ limit: 3, search: 'x' });
    expect(lastRequest().url).toBe(`${api}/prompts?limit=3&q=x`);
  });

  it('prompt CRUD and render hit the right URLs', async () => {
    const c = client();
    await c.createAgenticPrompt({ title: 't', prompt: 'p' } as never);
    expect([lastRequest().method, lastRequest().url]).toEqual([
      'POST',
      `${api}/prompts`,
    ]);

    await c.updateAgenticPrompt('p/1', { title: 'u' } as never);
    expect([lastRequest().method, lastRequest().url]).toEqual([
      'POST',
      `${api}/prompts/p%2F1`,
    ]);
    expect(await lastRequest().json()).toEqual({ title: 'u' });

    await c.renderAgenticPrompt('p1', { a: '1' });
    expect([lastRequest().method, lastRequest().url]).toEqual([
      'POST',
      `${api}/prompts/p1/render`,
    ]);
    expect(await lastRequest().json()).toEqual({ values: { a: '1' } });

    fetchMock.mockResolvedValueOnce(respond(204));
    await c.deleteAgenticPrompt('p1');
    expect([lastRequest().method, lastRequest().url]).toEqual([
      'DELETE',
      `${api}/prompts/p1`,
    ]);
  });
});

describe('ensureAgenticConversation', () => {
  const conversation = { id: 'c1', title: 'T' };

  it('returns the existing conversation', async () => {
    fetchMock.mockResolvedValueOnce(respond(200, conversation));
    const c = createAgenticChatClient({ apiBaseUrl: base });
    await expect(c.ensureAgenticConversation({ id: 'c1' })).resolves.toEqual(
      conversation,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('creates the conversation on 404', async () => {
    fetchMock
      .mockResolvedValueOnce(respond(404, { message: 'missing' }))
      .mockResolvedValueOnce(respond(201, conversation));
    const c = createAgenticChatClient({ apiBaseUrl: base });
    await expect(
      c.ensureAgenticConversation({ id: 'c1', title: 'T' }),
    ).resolves.toEqual(conversation);
    expect(lastRequest().method).toBe('POST');
    expect(await lastRequest().json()).toEqual({ id: 'c1', title: 'T' });
  });

  it('re-reads on a 409 create race', async () => {
    fetchMock
      .mockResolvedValueOnce(respond(404))
      .mockResolvedValueOnce(respond(409))
      .mockResolvedValueOnce(respond(200, conversation));
    const c = createAgenticChatClient({ apiBaseUrl: base });
    await expect(c.ensureAgenticConversation({ id: 'c1' })).resolves.toEqual(
      conversation,
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(lastRequest().method).toBe('GET');
  });

  it('rethrows non-404 read errors', async () => {
    fetchMock.mockResolvedValueOnce(respond(500, 'boom'));
    const c = createAgenticChatClient({ apiBaseUrl: base });
    await expect(
      c.ensureAgenticConversation({ id: 'c1' }),
    ).rejects.toMatchObject({ status: 500, message: 'boom' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rethrows non-409 create errors', async () => {
    fetchMock
      .mockResolvedValueOnce(respond(404))
      .mockResolvedValueOnce(respond(403, { message: 'forbidden' }));
    const c = createAgenticChatClient({ apiBaseUrl: base });
    await expect(
      c.ensureAgenticConversation({ id: 'c1' }),
    ).rejects.toMatchObject({ status: 403, message: 'forbidden' });
  });
});

describe(isAgenticFetchStatus.name, () => {
  it('matches only AgenticFetchError with the same status', () => {
    expect(isAgenticFetchStatus(new AgenticFetchError('x', 404), 404)).toBe(
      true,
    );
    expect(isAgenticFetchStatus(new AgenticFetchError('x', 500), 404)).toBe(
      false,
    );
    expect(
      isAgenticFetchStatus(Object.assign(new Error('x'), { status: 404 }), 404),
    ).toBe(false);
    expect(isAgenticFetchStatus(undefined, 404)).toBe(false);
  });
});
