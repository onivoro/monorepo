/**
 * @jest-environment node
 */
// Node supplies fetch/Request/Response; jsdom does not.
import { createBrowserAgenticChatAdapter } from './browser-agentic-chat-adapter';

const base = 'https://app.example.com';
let fetchMock: jest.Mock<Promise<Response>, [Request]>;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  fetchMock = jest.fn(
    async (_request: Request) => new Response('[]', { status: 200 }),
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

const lastRequest = () => fetchMock.mock.calls.at(-1)![0];

describe(createBrowserAgenticChatAdapter.name, () => {
  it('adds the Authorization header when provided', async () => {
    const adapter = createBrowserAgenticChatAdapter({
      apiBaseUrl: base,
      getAuthorizationHeader: () => 'Bearer abc',
      mcpAuthorizationHeaderName: 'X-Mcp-Authorization',
      getMcpAuthorizationHeader: () => 'Bearer mcp',
    });

    await adapter.listAgenticConversations();
    expect(lastRequest().headers.get('Authorization')).toBe('Bearer abc');
    expect(lastRequest().headers.has('X-Mcp-Authorization')).toBe(false);
    expect(lastRequest().url).toBe(`${base}/api/agentic-chat/conversations`);
  });

  it('adds the MCP authorization header only on POST', async () => {
    const adapter = createBrowserAgenticChatAdapter({
      apiBaseUrl: base,
      mcpAuthorizationHeaderName: 'X-Mcp-Authorization',
      getMcpAuthorizationHeader: () => 'Bearer mcp',
    });

    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await adapter.createAgenticConversation();
    const request = lastRequest();
    expect(request.method).toBe('POST');
    expect(request.headers.get('X-Mcp-Authorization')).toBe('Bearer mcp');
    expect(request.headers.has('Authorization')).toBe(false);
    expect(await request.json()).toEqual({});
  });

  it('omits headers when the getters return nothing or are absent', async () => {
    const adapter = createBrowserAgenticChatAdapter({
      apiBaseUrl: base,
      mcpAuthorizationHeaderName: 'X-Mcp-Authorization',
      getAuthorizationHeader: () => undefined,
      getMcpAuthorizationHeader: () => undefined,
    });
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await adapter.agenticFetch(adapter.agenticMessagesUrl('c1'), {
      method: 'POST',
      body: '{}',
    });
    expect(lastRequest().headers.has('Authorization')).toBe(false);
    expect(lastRequest().headers.has('X-Mcp-Authorization')).toBe(false);

    const bare = createBrowserAgenticChatAdapter({
      apiBaseUrl: base,
      mcpAuthorizationHeaderName: 'X-Mcp-Authorization',
    });
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await bare.createAgenticConversation({ id: 'c1' });
    expect(lastRequest().headers.has('X-Mcp-Authorization')).toBe(false);
  });

  it('forwards list options and exposes the prompt library', async () => {
    const adapter = createBrowserAgenticChatAdapter({
      apiBaseUrl: base,
      mcpAuthorizationHeaderName: 'X-Mcp',
    });
    await adapter.listAgenticConversations({ search: 'q' });
    expect(lastRequest().url).toBe(
      `${base}/api/agentic-chat/conversations?q=q`,
    );

    expect(adapter.promptLibrary).toEqual({
      createPrompt: adapter.createAgenticPrompt,
      deletePrompt: adapter.deleteAgenticPrompt,
      listPrompts: adapter.listAgenticPrompts,
      updatePrompt: adapter.updateAgenticPrompt,
    });
    expect(adapter.agenticFetch).toBe(adapter.agenticClient.agenticFetch);
    expect(typeof adapter.useAgenticChat).toBe('function');

    await adapter.promptLibrary.listPrompts({ search: 's' });
    expect(lastRequest().url).toBe(`${base}/api/agentic-chat/prompts?q=s`);
  });
});
