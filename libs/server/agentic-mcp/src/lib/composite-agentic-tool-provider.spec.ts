import { AgenticToolProvider } from '@onivoro/isomorphic-agentic';
import { CompositeAgenticToolProvider } from './composite-agentic-tool-provider';

const context = { conversationId: 'c', runId: 'r' };

function fakeProvider(names: string[]): jest.Mocked<AgenticToolProvider> {
  return {
    listTools: jest
      .fn()
      .mockResolvedValue(
        names.map((name) => ({ name, inputSchema: { type: 'object' } })),
      ),
    executeTool: jest.fn().mockImplementation(async (call) => ({
      toolCallId: call.id,
      name: call.name,
      result: `ran ${call.name} via ${names.join(',')}`,
    })),
  };
}

describe(CompositeAgenticToolProvider.name, () => {
  it('lists tools from every provider in order', async () => {
    const a = fakeProvider(['a1', 'a2']);
    const b = fakeProvider(['b1']);
    const composite = new CompositeAgenticToolProvider([a, b]);

    const tools = await composite.listTools(context);

    expect(tools.map((t) => t.name)).toEqual(['a1', 'a2', 'b1']);
    expect(a.listTools).toHaveBeenCalledWith(context);
    expect(b.listTools).toHaveBeenCalledWith(context);
  });

  it('routes execution to the first provider that lists the tool', async () => {
    const a = fakeProvider(['shared']);
    const b = fakeProvider(['shared', 'b-only']);
    const composite = new CompositeAgenticToolProvider([a, b]);

    await expect(
      composite.executeTool({ id: '1', name: 'shared', input: {} }, context),
    ).resolves.toMatchObject({ result: 'ran shared via shared' });
    expect(b.executeTool).not.toHaveBeenCalled();

    await expect(
      composite.executeTool({ id: '2', name: 'b-only', input: {} }, context),
    ).resolves.toMatchObject({ result: 'ran b-only via shared,b-only' });
    expect(a.executeTool).toHaveBeenCalledTimes(1);
  });

  it('returns an error result when no provider owns the tool', async () => {
    const composite = new CompositeAgenticToolProvider([fakeProvider(['x'])]);
    await expect(
      composite.executeTool({ id: '9', name: 'missing', input: {} }, context),
    ).resolves.toEqual({
      toolCallId: '9',
      name: 'missing',
      result: 'No tool provider found for missing',
      isError: true,
    });
  });

  it('works with no providers', async () => {
    const composite = new CompositeAgenticToolProvider([]);
    await expect(composite.listTools(context)).resolves.toEqual([]);
    await expect(
      composite.executeTool({ id: '1', name: 'x', input: undefined }, context),
    ).resolves.toMatchObject({ isError: true });
  });
});
