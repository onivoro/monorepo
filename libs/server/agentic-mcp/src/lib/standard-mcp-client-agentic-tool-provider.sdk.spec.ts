import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { StandardMcpClientAgenticToolProvider } from './standard-mcp-client-agentic-tool-provider';

// The MCP SDK's own v2 Client, against an SDK server, through the provider.
describe(`${StandardMcpClientAgenticToolProvider.name} with the MCP SDK client`, () => {
  it("lists and calls the server's tools, and reports tool errors", async () => {
    const server = new McpServer({ name: 'remote', version: '1.0.0' });
    server.registerTool(
      'greet',
      { description: 'Greet', inputSchema: z.object({ name: z.string() }) },
      async ({ name }) => ({
        content: [{ type: 'text', text: `Hello ${name}` }],
      }),
    );
    server.registerTool(
      'fail',
      { description: 'Fail', inputSchema: z.object({}) },
      async () => ({
        content: [{ type: 'text', text: 'Nope' }],
        isError: true,
      }),
    );
    const client = new Client(
      { name: 'agent', version: '1.0.0' },
      { versionNegotiation: { mode: 'legacy' } },
    );
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const provider = new StandardMcpClientAgenticToolProvider(client, {
      namespace: 'remote',
    });
    const context = { conversationId: 'c', runId: 'r' };

    const tools = await provider.listTools();
    const greeting = await provider.executeTool(
      { id: '1', name: 'mcp__remote__greet', input: { name: 'Ada' } },
      context,
    );
    const failure = await provider.executeTool(
      { id: '2', name: 'mcp__remote__fail', input: {} },
      context,
    );

    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'mcp__remote__fail',
      'mcp__remote__greet',
    ]);
    expect(greeting.isError).toBeUndefined();
    expect(greeting.resultText).toContain('Hello Ada');
    expect(failure).toMatchObject({ isError: true, resultText: 'Nope' });

    await client.close();
    await server.close();
  });
});
