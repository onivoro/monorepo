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

describe(`${AgenticChatService.name} streaming and lifecycle`, () => {
  function modelOf(
    ...steps: Array<unknown[] | (() => never)>
  ): AgenticModelProvider & { requests: unknown[] } {
    const requests: unknown[] = [];
    let step = 0;
    return {
      provider: 'test',
      model: 'test-model',
      requests,
      async *stream(request) {
        requests.push(request);
        const current = steps[Math.min(step++, steps.length - 1)];
        if (typeof current === 'function') current();
        for (const event of current as never[]) yield event;
      },
    };
  }

  function toolProviderOf(
    executeTool: AgenticToolProvider['executeTool'],
  ): AgenticToolProvider {
    return {
      async listTools() {
        return [{ name: 'lookup', inputSchema: { type: 'object' } }];
      },
      executeTool: jest.fn(executeTool),
    };
  }

  const toolCallStep = (input: unknown = {}) => [
    { type: 'tool-call', id: 'call-1', name: 'lookup', input },
    { type: 'finish', reason: 'tool-calls' },
  ];
  const textStep = [
    { type: 'text-delta', id: 'text-0', text: 'done' },
    { type: 'text-end', id: 'text-0' },
    { type: 'finish', reason: 'stop' },
  ];

  async function toolResultFor(
    toolProvider: AgenticToolProvider | undefined,
    config = {},
    input: Partial<Parameters<AgenticChatService['sendUserMessage']>[0]> = {},
    toolInput: unknown = {},
  ) {
    const messages = new InMemoryMessageRepository();
    const service = new AgenticChatService(
      { messages },
      modelOf(toolCallStep(toolInput), textStep),
      toolProvider,
      undefined,
      deterministicIds(),
      config,
    );
    await service.sendUserMessage({
      conversationId: 'conversation-1',
      text: 'go',
      ...input,
    });
    return (await messages.listByConversationId('conversation-1')).find(
      (item) => item.role === 'tool',
    )?.parts[0];
  }

  it('streams text and reasoning parts, records usage and completes the run', async () => {
    const messages = new InMemoryMessageRepository();
    const runs = {
      create: jest.fn(async (run) => ({ ...run, metadata: { created: true } })),
      update: jest.fn(async (run) => run),
      get: jest.fn(),
    };
    const usage = {
      recordMessageUsage: jest.fn(async () => undefined),
      recordRunUsage: jest.fn(async () => undefined),
    };
    const events: AgenticEvent[] = [];
    const model = modelOf([
      { type: 'reasoning-start', id: 'r-0' },
      { type: 'reasoning-delta', id: 'r-0', text: 'think' },
      { type: 'reasoning-delta', id: 'r-0', text: 'ing' },
      { type: 'reasoning-end', id: 'r-0' },
      { type: 'text-start', id: 't-0' },
      { type: 'text-delta', id: 't-0', text: 'Hi' },
      { type: 'text-end', id: 't-0' },
      { type: 'text-end', id: 'missing-part' },
      { type: 'step-finish', reason: 'stop', usage: { inputTokens: 2 } },
      {
        type: 'finish',
        reason: 'stop',
        usage: { inputTokens: 3, outputTokens: 4 },
      },
    ]);
    const service = new AgenticChatService(
      { messages, runs, usage },
      model,
      undefined,
      { publish: async (event) => void events.push(event) },
      deterministicIds(),
      { defaultSystemPrompt: 'be nice' },
    );

    const run = await service.sendUserMessage({
      conversationId: 'conversation-1',
      text: 'hi',
      userId: 'user-1',
      metadata: { tenant: 'a' },
    });

    expect(model.requests[0]).toMatchObject({
      system: 'be nice',
      tools: [],
      stepIndex: 0,
      metadata: { tenant: 'a' },
    });
    expect(run).toMatchObject({
      status: 'complete',
      metadata: { created: true },
      usage: { inputTokens: 5, outputTokens: 4 },
    });
    expect(runs.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'complete' }),
    );
    expect(usage.recordMessageUsage).toHaveBeenCalledWith(
      'msg-2',
      expect.objectContaining({ inputTokens: 5, outputTokens: 4 }),
    );
    expect(usage.recordRunUsage).toHaveBeenCalledWith(
      'run-0',
      expect.objectContaining({ inputTokens: 5, outputTokens: 4 }),
    );
    const assistant = (
      await messages.listByConversationId('conversation-1')
    ).find((item) => item.role === 'assistant');
    expect(assistant).toMatchObject({
      status: 'complete',
      model: 'test-model',
      provider: 'test',
    });
    expect(assistant?.parts).toMatchObject([
      { id: 'r-0', type: 'reasoning', text: 'thinking', status: 'complete' },
      { id: 't-0', type: 'text', text: 'Hi', status: 'complete' },
    ]);
    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        'message.upsert',
        'run.upsert',
        'message.part.upsert',
        'message.part.delta',
      ]),
    );
    expect(events.filter((event) => event.type === 'run.upsert')).toHaveLength(
      2,
    );
  });

  it('records empty usage when the model reports none', async () => {
    const usage = {
      recordMessageUsage: jest.fn(async () => undefined),
      recordRunUsage: jest.fn(async () => undefined),
    };
    const service = new AgenticChatService(
      { messages: new InMemoryMessageRepository(), usage },
      modelOf([{ type: 'finish', reason: 'stop' }]),
      undefined,
      undefined,
      deterministicIds(),
      undefined,
    );

    await service.sendUserMessage({ conversationId: 'c', text: 'hi' });

    expect(usage.recordMessageUsage).toHaveBeenCalledWith('msg-2', {});
    expect(usage.recordRunUsage).toHaveBeenCalledWith('run-0', {});
  });

  it('prefers the explicit system prompt and model over the defaults', async () => {
    const model = modelOf([{ type: 'finish', reason: 'stop' }]);
    const service = new AgenticChatService(
      { messages: new InMemoryMessageRepository() },
      model,
      undefined,
      undefined,
      deterministicIds(),
      { defaultSystemPrompt: 'default' },
    );

    const run = await service.sendUserMessage({
      conversationId: 'c',
      text: 'hi',
      system: 'explicit',
      model: 'other-model',
      temperature: 0.2,
      maxTokens: 10,
    });

    expect(model.requests[0]).toMatchObject({
      system: 'explicit',
      model: 'other-model',
      temperature: 0.2,
      maxTokens: 10,
    });
    expect(run.model).toBe('other-model');
  });

  it('falls back to timestamp ids when no id generator is provided', async () => {
    const service = new AgenticChatService(
      { messages: new InMemoryMessageRepository() },
      modelOf([{ type: 'finish', reason: 'stop' }]),
      undefined,
      undefined,
      undefined,
      undefined,
    );

    const run = await service.sendUserMessage({
      conversationId: 'c',
      text: 'hi',
    });

    expect(run.id).toMatch(/^run_\d+$/);
    expect(run.userMessageId).toMatch(/^msg_\d+$/);
  });

  it('marks the assistant message and run as aborted when the model finishes with abort', async () => {
    const messages = new InMemoryMessageRepository();
    const service = new AgenticChatService(
      { messages },
      modelOf([{ type: 'finish', reason: 'abort' }]),
      undefined,
      undefined,
      deterministicIds(),
      {},
    );

    const run = await service.sendUserMessage({
      conversationId: 'c',
      text: 'hi',
    });

    expect(run.status).toBe('aborted');
    expect(
      (await messages.listByConversationId('c')).find(
        (item) => item.role === 'assistant',
      )?.status,
    ).toBe('aborted');
  });

  it('publishes provider errors, records an error part and rethrows', async () => {
    const messages = new InMemoryMessageRepository();
    const runs = {
      create: jest.fn(async (run) => run),
      update: jest.fn(async (run) => run),
      get: jest.fn(),
    };
    const events: AgenticEvent[] = [];
    const service = new AgenticChatService(
      { messages, runs },
      modelOf([
        { type: 'text-delta', id: 't-0', text: 'partial' },
        { type: 'provider-error', message: 'throttled', retryable: true },
      ]),
      undefined,
      { publish: async (event) => void events.push(event) },
      deterministicIds(),
      {},
    );

    await expect(
      service.sendUserMessage({ conversationId: 'c', text: 'hi' }),
    ).rejects.toThrow('throttled');

    const runErrors = events.filter((event) => event.type === 'run.error');
    expect(runErrors).toEqual([
      expect.objectContaining({ message: 'throttled', retryable: true }),
      expect.objectContaining({ message: 'throttled', retryable: true }),
    ]);
    expect(runs.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'error', errorMessage: 'throttled' }),
    );
    const assistant = (await messages.listByConversationId('c')).find(
      (item) => item.role === 'assistant',
    );
    expect(assistant?.status).toBe('error');
    expect(assistant?.parts).toMatchObject([
      { type: 'text', text: 'partial' },
      { type: 'error', message: 'throttled', status: 'error' },
    ]);
  });

  it('stringifies non-Error failures from the model stream', async () => {
    const service = new AgenticChatService(
      { messages: new InMemoryMessageRepository() },
      modelOf(() => {
        throw 'plain failure';
      }),
      undefined,
      undefined,
      deterministicIds(),
      {},
    );

    await expect(
      service.sendUserMessage({ conversationId: 'c', text: 'hi' }),
    ).rejects.toBe('plain failure');
  });

  it.each([
    ['name', Object.assign(new Error('stop'), { name: 'AbortError' })],
    ['message', new Error('AbortError')],
    ['node message', new Error('The operation was aborted')],
  ])(
    'resolves an aborted run instead of throwing (abort detected by %s)',
    async (_label, error) => {
      const messages = new InMemoryMessageRepository();
      const events: AgenticEvent[] = [];
      const service = new AgenticChatService(
        { messages },
        modelOf(() => {
          throw error;
        }),
        undefined,
        { publish: async (event) => void events.push(event) },
        deterministicIds(),
        {},
      );

      const run = await service.sendUserMessage({
        conversationId: 'c',
        text: 'hi',
      });

      expect(run).toMatchObject({
        status: 'aborted',
        errorMessage: error.message,
      });
      expect(events.find((event) => event.type === 'run.error')).toMatchObject({
        retryable: false,
      });
      expect(
        (await messages.listByConversationId('c')).find(
          (item) => item.role === 'assistant',
        )?.parts,
      ).toMatchObject([{ type: 'error', status: 'aborted' }]);
    },
  );

  it('streams tool input deltas into the tool-call part before executing it', async () => {
    const messages = new InMemoryMessageRepository();
    const toolProvider = toolProviderOf(async (call) => ({
      toolCallId: call.id,
      name: call.name,
      result: { ok: true },
    }));
    const service = new AgenticChatService(
      { messages },
      modelOf(
        [
          { type: 'tool-input-delta', id: 'call-1', name: 'lookup', text: '{' },
          { type: 'tool-input-delta', id: 'call-1', name: 'lookup', text: '}' },
          { type: 'tool-input-end', id: 'call-1', name: 'lookup' },
          { type: 'tool-call', id: 'call-1', name: 'lookup', input: {} },
          { type: 'finish', reason: 'tool-calls' },
        ],
        textStep,
      ),
      toolProvider,
      undefined,
      deterministicIds(),
      {},
    );

    await service.sendUserMessage({
      conversationId: 'c',
      text: 'go',
      userId: 'u',
      sessionId: 's',
      authInfo: { token: 't' },
    });

    expect(toolProvider.executeTool).toHaveBeenCalledWith(
      { id: 'call-1', name: 'lookup', input: {}, providerMetadata: undefined },
      expect.objectContaining({
        conversationId: 'c',
        userId: 'u',
        sessionId: 's',
        authInfo: { token: 't' },
        signal: expect.any(Object),
      }),
    );
    const persisted = await messages.listByConversationId('c');
    expect(
      persisted
        .find((item) => item.role === 'assistant')
        ?.parts.find((part) => part.type === 'tool-call'),
    ).toMatchObject({ inputText: '{}', status: 'complete' });
    expect(
      persisted.find((item) => item.role === 'tool')?.parts[0],
    ).toMatchObject({
      resultText: JSON.stringify({ ok: true }, null, 2),
      status: 'complete',
    });
  });

  it('reports a missing tool provider as a tool error', async () => {
    await expect(toolResultFor(undefined)).resolves.toMatchObject({
      isError: true,
      result: 'Tool provider is not configured for lookup',
    });
  });

  it('turns thrown tool errors into tool error results', async () => {
    await expect(
      toolResultFor(
        toolProviderOf(async () => {
          throw new Error('boom');
        }),
      ),
    ).resolves.toMatchObject({ isError: true, result: 'boom' });

    await expect(
      toolResultFor(
        toolProviderOf(async () => {
          throw 'string failure';
        }),
      ),
    ).resolves.toMatchObject({ isError: true, result: 'string failure' });
  });

  it('executes tools whose input is not a plain object', async () => {
    const provider = toolProviderOf(async (call) => ({
      toolCallId: call.id,
      name: call.name,
      result: 'ok',
    }));
    await toolResultFor(provider, {}, {}, ['a']);
    await toolResultFor(provider, {}, {}, null);
    expect(provider.executeTool).toHaveBeenCalledTimes(2);
  });

  it('prefers provider resultText and truncates long tool results', async () => {
    await expect(
      toolResultFor(
        toolProviderOf(async (call) => ({
          toolCallId: call.id,
          name: call.name,
          result: 'ignored',
          resultText: 'abcdefghij',
        })),
        { maxToolResultTextLength: 4 },
      ),
    ).resolves.toMatchObject({ resultText: 'abcd\n... [truncated]' });
  });

  it('falls back to String() for results that cannot be serialized', async () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    await expect(
      toolResultFor(
        toolProviderOf(async (call) => ({
          toolCallId: call.id,
          name: call.name,
          result: circular,
        })),
      ),
    ).resolves.toMatchObject({ resultText: '[object Object]' });
  });

  it('runs tools without a timer when the timeout is disabled', async () => {
    await expect(
      toolResultFor(
        toolProviderOf(async (call) => ({
          toolCallId: call.id,
          name: call.name,
          result: 'slow but fine',
        })),
        { toolExecutionTimeoutMs: 0 },
      ),
    ).resolves.toMatchObject({ resultText: 'slow but fine' });
  });

  it('aborts tool execution immediately when the request signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort('user cancelled');
    const provider = toolProviderOf(() => new Promise(() => undefined));

    await expect(
      toolResultFor(provider, {}, { signal: controller.signal }),
    ).resolves.toMatchObject({ isError: true, result: 'user cancelled' });
  });

  it('aborts in-flight tool execution when the request signal aborts', async () => {
    const controller = new AbortController();
    const reason = new Error('cancelled mid-flight');
    const provider = toolProviderOf((_call, context) => {
      setTimeout(() => controller.abort(reason), 0);
      return new Promise((_resolve, reject) => {
        context.signal?.addEventListener('abort', () =>
          reject(new Error('should lose the race')),
        );
      });
    });

    await expect(
      toolResultFor(provider, {}, { signal: controller.signal }),
    ).resolves.toMatchObject({ isError: true, result: 'cancelled mid-flight' });
  });

  it('keeps partially stale tool messages and strips stale tool calls from other runs', async () => {
    const messages = new InMemoryMessageRepository([
      message({
        id: 'assistant-no-run',
        role: 'assistant',
        parts: [
          {
            id: 'p-call',
            type: 'tool-call',
            toolCallId: 'bad-call',
            name: 'x',
            input: {},
          },
          { id: 'p-text', type: 'text', text: 'kept text' },
        ],
      }),
      message({
        id: 'assistant-only-call',
        role: 'assistant',
        parts: [
          {
            id: 'p-call-2',
            type: 'tool-call',
            toolCallId: 'bad-call',
            name: 'x',
            input: {},
          },
        ],
      }),
      message({
        id: 'tool-mixed',
        role: 'tool',
        parts: [
          {
            id: 'p-bad',
            type: 'tool-result',
            toolCallId: 'bad-call',
            name: 'x',
            result: 'fail',
            isError: true,
          },
          {
            id: 'p-good',
            type: 'tool-result',
            toolCallId: 'good-call',
            name: 'x',
            result: 'ok',
          },
        ],
      }),
      message({
        id: 'tool-good',
        role: 'tool',
        parts: [
          {
            id: 'p-good-2',
            type: 'tool-result',
            toolCallId: 'good-call-2',
            name: 'x',
            result: 'ok',
          },
        ],
      }),
      message({
        id: 'assistant-clean',
        role: 'assistant',
        parts: [{ id: 'p-clean', type: 'text', text: 'clean' }],
      }),
      message({
        id: 'system-message',
        role: 'system',
        parts: [{ id: 'p-sys', type: 'text', text: 'sys' }],
      }),
    ]);
    const model = modelOf([{ type: 'finish', reason: 'stop' }]);
    const service = new AgenticChatService(
      { messages },
      model,
      undefined,
      undefined,
      deterministicIds(),
      {},
    );

    await service.sendUserMessage({
      conversationId: 'conversation-1',
      text: 'x',
    });

    const sent = (model.requests[0] as { messages: AgenticMessage[] }).messages;
    expect(sent.map((item) => item.id)).toEqual([
      'assistant-no-run',
      'tool-mixed',
      'tool-good',
      'assistant-clean',
      'system-message',
      'msg-1',
    ]);
    expect(sent[0].parts.map((part) => part.id)).toEqual(['p-text']);
    expect(sent[1].parts.map((part) => part.id)).toEqual(['p-good']);
  });
});
