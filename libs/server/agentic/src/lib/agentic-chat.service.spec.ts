import {
  AgenticEvent,
  AgenticMessage,
  AgenticMessageRepository,
  AgenticModelProvider,
  AgenticRepositories,
  AgenticToolProvider,
} from '@onivoro/isomorphic-agentic';
import { AgenticChatService } from './agentic-chat.service';

describe(AgenticChatService.name, () => {
  it('persists user and assistant messages while publishing normalized deltas', async () => {
    const messages = new InMemoryMessageRepository();
    const events: AgenticEvent[] = [];
    const modelProvider: AgenticModelProvider = {
      provider: 'test',
      model: 'test-model',
      async *stream() {
        yield { type: 'step-start', index: 0 };
        yield { type: 'text-delta', id: 'text-0', text: 'hello' };
        yield { type: 'text-end', id: 'text-0' };
        yield { type: 'finish', reason: 'stop' };
      },
    };
    let id = 0;
    const service = new AgenticChatService(
      { messages } satisfies AgenticRepositories,
      modelProvider,
      undefined,
      {
        publish: async (event) => {
          events.push(event);
        },
      },
      { createId: (prefix) => `${prefix}-${id++}` },
      {},
    );

    await service.sendUserMessage({
      conversationId: 'conversation-1',
      text: 'hi',
    });

    const persisted = await messages.listByConversationId('conversation-1');
    expect(persisted.map((message) => message.role)).toEqual([
      'user',
      'assistant',
    ]);
    expect(Date.parse(persisted[1].createdAt)).toBeGreaterThan(
      Date.parse(persisted[0].createdAt),
    );
    expect(persisted[1].parts).toMatchObject([
      { type: 'text', text: 'hello', status: 'complete' },
    ]);
    expect(events.some((event) => event.type === 'message.part.delta')).toBe(
      true,
    );
  });

  it('omits stale errored tool interactions from later model requests', async () => {
    const messages = new InMemoryMessageRepository([
      message({
        id: 'old-user-message',
        role: 'user',
        runId: 'old-run',
        parts: [{ id: 'old-user-part', type: 'text', text: 'show orders' }],
      }),
      message({
        id: 'old-assistant-message',
        role: 'assistant',
        runId: 'old-run',
        parts: [
          {
            id: 'old-tool-call-part',
            type: 'tool-call',
            toolCallId: 'old-tool-call',
            name: 'list-orders',
            input: {},
          },
          {
            id: 'old-text-part',
            type: 'text',
            text: 'The order tool failed with an auth error.',
          },
        ],
      }),
      message({
        id: 'old-tool-message',
        role: 'tool',
        runId: 'old-run',
        parts: [
          {
            id: 'old-tool-result-part',
            type: 'tool-result',
            toolCallId: 'old-tool-call',
            name: 'list-orders',
            result: 'Invalid JWT',
            isError: true,
          },
        ],
      }),
    ]);
    const requestedMessages: AgenticMessage[][] = [];
    const modelProvider: AgenticModelProvider = {
      provider: 'test',
      model: 'test-model',
      async *stream(request) {
        requestedMessages.push(request.messages);
        yield { type: 'text-delta', id: 'text-0', text: 'retrying' };
        yield { type: 'text-end', id: 'text-0' };
        yield { type: 'finish', reason: 'stop' };
      },
    };
    const service = new AgenticChatService(
      { messages } satisfies AgenticRepositories,
      modelProvider,
      undefined,
      undefined,
      deterministicIds(),
      {},
    );

    await service.sendUserMessage({
      conversationId: 'conversation-1',
      text: 'try again',
    });

    expect(requestedMessages[0].map((item) => item.id)).toEqual([
      'old-user-message',
      'msg-1',
    ]);
  });

  it('keeps current-run tool errors visible to the next model step', async () => {
    const messages = new InMemoryMessageRepository();
    const requestedMessages: AgenticMessage[][] = [];
    let step = 0;
    const modelProvider: AgenticModelProvider = {
      provider: 'test',
      model: 'test-model',
      async *stream(request) {
        requestedMessages.push(request.messages);
        if (step++ === 0) {
          yield {
            type: 'tool-call',
            id: 'current-tool-call',
            name: 'list-orders',
            input: {},
          };
          yield { type: 'finish', reason: 'tool-calls' };
          return;
        }

        yield { type: 'text-delta', id: 'text-0', text: 'saw error' };
        yield { type: 'text-end', id: 'text-0' };
        yield { type: 'finish', reason: 'stop' };
      },
    };
    const toolProvider: AgenticToolProvider = {
      async listTools() {
        return [
          {
            name: 'list-orders',
            inputSchema: { type: 'object', properties: {} },
          },
        ];
      },
      async executeTool(call) {
        return {
          toolCallId: call.id,
          name: call.name,
          result: 'fresh auth failure',
          isError: true,
        };
      },
    };
    const service = new AgenticChatService(
      { messages } satisfies AgenticRepositories,
      modelProvider,
      toolProvider,
      undefined,
      deterministicIds(),
      {},
    );

    await service.sendUserMessage({
      conversationId: 'conversation-1',
      text: 'show orders',
    });

    expect(requestedMessages[1].some((item) => item.role === 'tool')).toBe(
      true,
    );
  });

  it('turns malformed tool JSON into a tool error without calling the provider', async () => {
    const messages = new InMemoryMessageRepository();
    let step = 0;
    const modelProvider: AgenticModelProvider = {
      provider: 'test',
      model: 'test-model',
      async *stream() {
        if (step++ === 0) {
          yield {
            type: 'tool-call',
            id: 'malformed-tool-call',
            name: 'get-account-identifiers-by-email',
            input: {
              _raw: '{"email":',
              _parseError: 'Unexpected end of JSON input',
            },
          };
          yield { type: 'finish', reason: 'tool-calls' };
          return;
        }

        yield {
          type: 'text-delta',
          id: 'text-0',
          text: 'I need a complete email address.',
        };
        yield { type: 'text-end', id: 'text-0' };
        yield { type: 'finish', reason: 'stop' };
      },
    };
    const toolProvider: AgenticToolProvider = {
      async listTools() {
        return [
          {
            name: 'get-account-identifiers-by-email',
            inputSchema: {
              type: 'object',
              properties: { email: { type: 'string' } },
            },
          },
        ];
      },
      executeTool: jest.fn(),
    };
    const service = new AgenticChatService(
      { messages } satisfies AgenticRepositories,
      modelProvider,
      toolProvider,
      undefined,
      deterministicIds(),
      {},
    );

    await service.sendUserMessage({
      conversationId: 'conversation-1',
      text: 'lookup account',
    });

    expect(toolProvider.executeTool).not.toHaveBeenCalled();
    const toolMessage = (
      await messages.listByConversationId('conversation-1')
    ).find((item) => item.role === 'tool');
    expect(toolMessage?.parts[0]).toMatchObject({
      type: 'tool-result',
      toolCallId: 'malformed-tool-call',
      name: 'get-account-identifiers-by-email',
      isError: true,
      result: {
        code: 'invalid_tool_arguments',
        message: 'Invalid JSON tool arguments: Unexpected end of JSON input',
      },
    });
  });

  it('finalizes streamed tool input that never becomes an executable tool call', async () => {
    const messages = new InMemoryMessageRepository();
    const requestedMessages: AgenticMessage[][] = [];
    let step = 0;
    const modelProvider: AgenticModelProvider = {
      provider: 'test',
      model: 'test-model',
      async *stream(request) {
        requestedMessages.push(request.messages);
        if (step++ === 0) {
          yield {
            type: 'tool-input-start',
            id: 'orphan-tool-call',
            name: 'get-account-identifiers-by-email',
          };
          yield {
            type: 'tool-input-delta',
            id: 'orphan-tool-call',
            name: 'get-account-identifiers-by-email',
            text: '{"email":',
          };
          yield {
            type: 'tool-input-end',
            id: 'orphan-tool-call',
            name: 'get-account-identifiers-by-email',
          };
          yield { type: 'finish', reason: 'tool-calls' };
          return;
        }

        yield {
          type: 'text-delta',
          id: 'text-0',
          text: 'The previous tool call was incomplete.',
        };
        yield { type: 'text-end', id: 'text-0' };
        yield { type: 'finish', reason: 'stop' };
      },
    };
    const service = new AgenticChatService(
      { messages } satisfies AgenticRepositories,
      modelProvider,
      {
        async listTools() {
          return [];
        },
        executeTool: jest.fn(),
      },
      undefined,
      deterministicIds(),
      {},
    );

    await service.sendUserMessage({
      conversationId: 'conversation-1',
      text: 'lookup account',
    });

    const persisted = await messages.listByConversationId('conversation-1');
    const assistant = persisted.find((item) => item.role === 'assistant');
    const toolMessage = persisted.find((item) => item.role === 'tool');

    expect(assistant?.parts).toContainEqual(
      expect.objectContaining({
        type: 'tool-call',
        toolCallId: 'orphan-tool-call',
        status: 'error',
      }),
    );
    expect(toolMessage?.parts[0]).toMatchObject({
      type: 'tool-result',
      toolCallId: 'orphan-tool-call',
      isError: true,
      result: {
        code: 'incomplete_tool_call',
      },
    });
    expect(requestedMessages[1].some((item) => item.role === 'tool')).toBe(
      true,
    );
  });

  it('does not leave last-step tool calls pending when max model steps are reached', async () => {
    const messages = new InMemoryMessageRepository();
    const toolProvider: AgenticToolProvider = {
      async listTools() {
        return [
          {
            name: 'lookup',
            inputSchema: { type: 'object', properties: {} },
          },
        ];
      },
      executeTool: jest.fn(),
    };
    const modelProvider: AgenticModelProvider = {
      provider: 'test',
      model: 'test-model',
      async *stream() {
        yield {
          type: 'tool-call',
          id: 'last-step-tool-call',
          name: 'lookup',
          input: {},
        };
        yield { type: 'finish', reason: 'tool-calls' };
      },
    };
    const service = new AgenticChatService(
      { messages } satisfies AgenticRepositories,
      modelProvider,
      toolProvider,
      undefined,
      deterministicIds(),
      { maxModelSteps: 1 },
    );

    await service.sendUserMessage({
      conversationId: 'conversation-1',
      text: 'lookup',
    });

    expect(toolProvider.executeTool).not.toHaveBeenCalled();
    const persisted = await messages.listByConversationId('conversation-1');
    expect(
      persisted
        .find((item) => item.role === 'assistant')
        ?.parts.find((part) => part.type === 'tool-call'),
    ).toMatchObject({
      toolCallId: 'last-step-tool-call',
      status: 'error',
    });
    expect(
      persisted.find((item) => item.role === 'tool')?.parts[0],
    ).toMatchObject({
      type: 'tool-result',
      toolCallId: 'last-step-tool-call',
      isError: true,
      result: {
        code: 'max_model_steps_reached',
      },
    });
  });

  it('times out tool execution and gives the model a tool error', async () => {
    const messages = new InMemoryMessageRepository();
    let step = 0;
    const modelProvider: AgenticModelProvider = {
      provider: 'test',
      model: 'test-model',
      async *stream() {
        if (step++ === 0) {
          yield {
            type: 'tool-call',
            id: 'slow-tool-call',
            name: 'slow-tool',
            input: {},
          };
          yield { type: 'finish', reason: 'tool-calls' };
          return;
        }

        yield { type: 'text-delta', id: 'text-0', text: 'tool timed out' };
        yield { type: 'text-end', id: 'text-0' };
        yield { type: 'finish', reason: 'stop' };
      },
    };
    const service = new AgenticChatService(
      { messages } satisfies AgenticRepositories,
      modelProvider,
      {
        async listTools() {
          return [
            {
              name: 'slow-tool',
              inputSchema: { type: 'object', properties: {} },
            },
          ];
        },
        async executeTool() {
          return new Promise(() => undefined);
        },
      },
      undefined,
      deterministicIds(),
      { toolExecutionTimeoutMs: 1 },
    );

    await service.sendUserMessage({
      conversationId: 'conversation-1',
      text: 'lookup',
    });

    expect(
      (await messages.listByConversationId('conversation-1')).find(
        (item) => item.role === 'tool',
      )?.parts[0],
    ).toMatchObject({
      type: 'tool-result',
      toolCallId: 'slow-tool-call',
      isError: true,
      result: 'Tool execution timed out after 1ms',
    });
  });

  it('persists undefined tool results as null text instead of crashing', async () => {
    const messages = new InMemoryMessageRepository();
    let step = 0;
    const modelProvider: AgenticModelProvider = {
      provider: 'test',
      model: 'test-model',
      async *stream() {
        if (step++ === 0) {
          yield {
            type: 'tool-call',
            id: 'not-found-tool-call',
            name: 'get-ivim-order-by-id',
            input: { id: 4250578 },
          };
          yield { type: 'finish', reason: 'tool-calls' };
          return;
        }

        yield { type: 'text-delta', id: 'text-0', text: 'No order found.' };
        yield { type: 'text-end', id: 'text-0' };
        yield { type: 'finish', reason: 'stop' };
      },
    };
    const service = new AgenticChatService(
      { messages } satisfies AgenticRepositories,
      modelProvider,
      {
        async listTools() {
          return [
            {
              name: 'get-ivim-order-by-id',
              inputSchema: {
                type: 'object',
                properties: { id: { type: 'number' } },
              },
            },
          ];
        },
        async executeTool(call) {
          return {
            toolCallId: call.id,
            name: call.name,
            result: undefined,
          };
        },
      },
      undefined,
      deterministicIds(),
      {},
    );

    await service.sendUserMessage({
      conversationId: 'conversation-1',
      text: 'lookup order',
    });

    expect(
      (await messages.listByConversationId('conversation-1')).find(
        (item) => item.role === 'tool',
      )?.parts[0],
    ).toMatchObject({
      type: 'tool-result',
      toolCallId: 'not-found-tool-call',
      result: undefined,
      resultText: 'null',
      status: 'complete',
    });
  });
});

class InMemoryMessageRepository implements AgenticMessageRepository {
  constructor(private readonly messages: AgenticMessage[] = []) {}

  async create(message: AgenticMessage): Promise<AgenticMessage> {
    this.messages.push(message);
    return message;
  }

  async update(message: AgenticMessage): Promise<AgenticMessage> {
    const index = this.messages.findIndex((item) => item.id === message.id);
    if (index >= 0) this.messages[index] = message;
    return message;
  }

  async get(
    conversationId: string,
    messageId: string,
  ): Promise<AgenticMessage | undefined> {
    return this.messages.find(
      (message) =>
        message.conversationId === conversationId && message.id === messageId,
    );
  }

  async listByConversationId(
    conversationId: string,
  ): Promise<AgenticMessage[]> {
    return this.messages.filter(
      (message) => message.conversationId === conversationId,
    );
  }

  async upsertPart(
    conversationId: string,
    messageId: string,
    part: AgenticMessage['parts'][number],
  ): Promise<void> {
    const message = await this.get(conversationId, messageId);
    if (!message) return;
    const index = message.parts.findIndex((item) => item.id === part.id);
    if (index === -1) message.parts.push(part);
    else message.parts[index] = part;
  }

  async appendPartDelta(
    conversationId: string,
    messageId: string,
    partId: string,
    field: 'text' | 'inputText' | 'resultText',
    delta: string,
  ): Promise<void> {
    const message = await this.get(conversationId, messageId);
    const part = message?.parts.find((item) => item.id === partId);
    if (!part) return;
    const writablePart = part as unknown as Record<string, string>;
    writablePart[field] = `${writablePart[field] ?? ''}${delta}`;
  }
}

function deterministicIds(): { createId(prefix: string): string } {
  let id = 0;
  return { createId: (prefix) => `${prefix}-${id++}` };
}

function message(
  input: Partial<AgenticMessage> &
    Pick<AgenticMessage, 'id' | 'role' | 'parts'>,
): AgenticMessage {
  return {
    conversationId: 'conversation-1',
    status: 'complete',
    createdAt: '2026-05-30T00:00:00.000Z',
    updatedAt: '2026-05-30T00:00:00.000Z',
    ...input,
  };
}
