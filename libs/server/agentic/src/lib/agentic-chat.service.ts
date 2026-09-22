import {
  AgenticDeltaField,
  AgenticEvent,
  AgenticEventContext,
  AgenticEventPublisher,
  AgenticFinishReason,
  AgenticMessage,
  AgenticModelEvent,
  AgenticModelProvider,
  AgenticPart,
  AgenticRepositories,
  AgenticRun,
  AgenticToolCall,
  AgenticToolCallPart,
  AgenticToolExecutionContext,
  AgenticToolExecutionResult,
  AgenticToolProvider,
  AgenticUsage,
  JsonObject,
  mergeAgenticUsage,
} from '@onivoro/isomorphic-agentic';
import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  AGENTIC_CHAT_CONFIG,
  AGENTIC_EVENT_PUBLISHER,
  AGENTIC_ID_GENERATOR,
  AGENTIC_MODEL_PROVIDER,
  AGENTIC_REPOSITORIES,
  AGENTIC_TOOL_PROVIDER,
} from './agentic-chat.tokens';
import {
  AgenticChatConfig,
  DEFAULT_AGENTIC_CHAT_CONFIG,
} from './agentic-chat-config';
import { AgenticIdGenerator } from './default-agentic-id-generator';

export interface AgenticSendUserMessageInput {
  conversationId: string;
  text: string;
  userId?: string;
  sessionId?: string;
  system?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  metadata?: JsonObject;
  authInfo?: unknown;
}

@Injectable()
export class AgenticChatService {
  constructor(
    @Inject(AGENTIC_REPOSITORIES)
    private readonly repositories: AgenticRepositories,
    @Inject(AGENTIC_MODEL_PROVIDER)
    private readonly modelProvider: AgenticModelProvider,
    @Optional()
    @Inject(AGENTIC_TOOL_PROVIDER)
    private readonly toolProvider: AgenticToolProvider | undefined,
    @Optional()
    @Inject(AGENTIC_EVENT_PUBLISHER)
    private readonly eventPublisher: AgenticEventPublisher | undefined,
    @Optional()
    @Inject(AGENTIC_ID_GENERATOR)
    private readonly idGenerator: AgenticIdGenerator | undefined,
    @Optional()
    @Inject(AGENTIC_CHAT_CONFIG)
    private readonly config: AgenticChatConfig | undefined,
  ) {}

  async sendUserMessage(
    input: AgenticSendUserMessageInput,
  ): Promise<AgenticRun> {
    const now = this.now();
    const assistantCreatedAt = new Date(Date.parse(now) + 1).toISOString();
    const runId = this.createId('run');
    const userMessageId = this.createId('msg');
    const assistantMessageId = this.createId('msg');
    const context: AgenticEventContext = {
      conversationId: input.conversationId,
      runId,
      userId: input.userId,
      sessionId: input.sessionId,
    };

    const userMessage: AgenticMessage = {
      id: userMessageId,
      conversationId: input.conversationId,
      role: 'user',
      status: 'complete',
      runId,
      parts: [
        {
          id: this.createId('part'),
          type: 'text',
          text: input.text,
          status: 'complete',
          createdAt: now,
          updatedAt: now,
        },
      ],
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
    };

    let assistantMessage: AgenticMessage = {
      id: assistantMessageId,
      conversationId: input.conversationId,
      role: 'assistant',
      status: 'streaming',
      runId,
      model: input.model ?? this.modelProvider.model,
      provider: this.modelProvider.provider,
      parts: [],
      createdAt: assistantCreatedAt,
      updatedAt: assistantCreatedAt,
    };

    let run: AgenticRun = {
      id: runId,
      conversationId: input.conversationId,
      status: 'running',
      userMessageId,
      assistantMessageId,
      model: assistantMessage.model,
      provider: assistantMessage.provider,
      startedAt: now,
      updatedAt: now,
      metadata: input.metadata,
    };

    await this.repositories.messages.create(userMessage);
    await this.publish(
      {
        type: 'message.upsert',
        conversationId: input.conversationId,
        message: userMessage,
      },
      context,
    );

    await this.repositories.messages.create(assistantMessage);
    await this.publish(
      {
        type: 'message.upsert',
        conversationId: input.conversationId,
        message: assistantMessage,
      },
      context,
    );

    if (this.repositories.runs) {
      run = await this.repositories.runs.create(run);
    }
    await this.publish(
      { type: 'run.upsert', conversationId: input.conversationId, run },
      context,
    );

    let usage: AgenticUsage | undefined;
    let finishReason: AgenticFinishReason = 'unknown';

    try {
      const maxSteps =
        this.config?.maxModelSteps ?? DEFAULT_AGENTIC_CHAT_CONFIG.maxModelSteps;

      for (let stepIndex = 0; stepIndex < maxSteps; stepIndex++) {
        const toolContext: AgenticToolExecutionContext = {
          conversationId: input.conversationId,
          runId,
          userId: input.userId,
          sessionId: input.sessionId,
          authInfo: input.authInfo,
          signal: input.signal,
          metadata: input.metadata,
        };
        const tools = this.toolProvider
          ? await this.toolProvider.listTools(toolContext)
          : [];
        const toolCalls: AgenticToolCall[] = [];
        const messages = await this.modelMessages(
          input.conversationId,
          assistantMessage,
          runId,
        );

        for await (const event of this.modelProvider.stream({
          conversationId: input.conversationId,
          runId,
          messages,
          system: input.system ?? this.config?.defaultSystemPrompt,
          tools,
          model: input.model,
          temperature: input.temperature,
          maxTokens: input.maxTokens,
          stepIndex,
          signal: input.signal,
          metadata: input.metadata,
        })) {
          const result = await this.handleModelEvent({
            assistantMessage,
            context,
            event,
            stepIndex,
          });
          assistantMessage = result.assistantMessage;
          usage = mergeAgenticUsage(usage, result.usage);
          finishReason = result.finishReason ?? finishReason;
          if (result.toolCall) toolCalls.push(result.toolCall);
        }

        const orphanedToolCallResults = await this.finalizeOrphanedToolCalls({
          assistantMessage,
          conversationId: input.conversationId,
          runId,
          assistantMessageId,
          handledToolCallIds: new Set(toolCalls.map((toolCall) => toolCall.id)),
          context,
        });
        assistantMessage = orphanedToolCallResults.assistantMessage;

        if (!toolCalls.length && !orphanedToolCallResults.count) break;

        if (stepIndex === maxSteps - 1) {
          for (const toolCall of toolCalls) {
            const result = maxModelStepsReachedToolResult(toolCall);
            assistantMessage = await this.markToolCallComplete(
              assistantMessage,
              toolCall.id,
              result,
              context,
            );
            await this.persistToolResultMessage({
              conversationId: input.conversationId,
              runId,
              assistantMessageId,
              result,
              context,
            });
          }
          break;
        }

        for (const toolCall of toolCalls) {
          const result = await this.executeTool(toolCall, toolContext);
          assistantMessage = await this.markToolCallComplete(
            assistantMessage,
            toolCall.id,
            result,
            context,
          );
          await this.persistToolResultMessage({
            conversationId: input.conversationId,
            runId,
            assistantMessageId,
            result,
            context,
          });
        }
      }

      assistantMessage = {
        ...assistantMessage,
        status: finishReason === 'abort' ? 'aborted' : 'complete',
        usage,
        updatedAt: this.now(),
      };
      await this.repositories.messages.update(assistantMessage);
      await this.repositories.usage?.recordMessageUsage(
        assistantMessage.id,
        usage ?? {},
      );
      await this.publish(
        {
          type: 'message.upsert',
          conversationId: input.conversationId,
          message: assistantMessage,
        },
        context,
      );

      run = {
        ...run,
        status: assistantMessage.status === 'aborted' ? 'aborted' : 'complete',
        usage,
        completedAt: this.now(),
        updatedAt: this.now(),
      };
      await this.repositories.runs?.update(run);
      await this.repositories.usage?.recordRunUsage(run.id, usage ?? {});
      await this.publish(
        { type: 'run.upsert', conversationId: input.conversationId, run },
        context,
      );

      return run;
    } catch (error) {
      const aborted = isAbortError(error);
      const message = error instanceof Error ? error.message : String(error);
      assistantMessage = {
        ...assistantMessage,
        status: aborted ? 'aborted' : 'error',
        parts: [
          ...assistantMessage.parts,
          {
            id: this.createId('part'),
            type: 'error',
            message,
            status: aborted ? 'aborted' : 'error',
            createdAt: this.now(),
            updatedAt: this.now(),
          },
        ],
        updatedAt: this.now(),
      };
      await this.repositories.messages.update(assistantMessage);
      await this.publish(
        {
          type: 'message.upsert',
          conversationId: input.conversationId,
          message: assistantMessage,
        },
        context,
      );

      run = {
        ...run,
        status: aborted ? 'aborted' : 'error',
        errorMessage: message,
        completedAt: this.now(),
        updatedAt: this.now(),
      };
      await this.repositories.runs?.update(run);
      await this.publish(
        { type: 'run.upsert', conversationId: input.conversationId, run },
        context,
      );
      await this.publish(
        {
          type: 'run.error',
          conversationId: input.conversationId,
          runId,
          message,
          retryable: !aborted,
        },
        context,
      );

      if (aborted) return run;
      throw error;
    }
  }

  private async modelMessages(
    conversationId: string,
    assistantMessage: AgenticMessage,
    currentRunId: string,
  ): Promise<AgenticMessage[]> {
    const messages = await this.repositories.messages.listByConversationId(
      conversationId,
      { includeCompacted: false },
    );
    return filterStaleErroredToolInteractions(
      messages.filter(
        (message) =>
          message.id !== assistantMessage.id ||
          assistantMessage.parts.length > 0,
      ),
      currentRunId,
    );
  }

  private async handleModelEvent({
    assistantMessage,
    context,
    event,
  }: {
    assistantMessage: AgenticMessage;
    context: AgenticEventContext;
    event: AgenticModelEvent;
    stepIndex: number;
  }): Promise<{
    assistantMessage: AgenticMessage;
    usage?: AgenticUsage;
    finishReason?: AgenticFinishReason;
    toolCall?: AgenticToolCall;
  }> {
    if (event.type === 'text-start') {
      return {
        assistantMessage: await this.upsertAssistantPart(
          assistantMessage,
          {
            id: event.id,
            type: 'text',
            text: '',
            status: 'streaming',
            createdAt: this.now(),
            updatedAt: this.now(),
            providerMetadata: event.providerMetadata,
          },
          context,
        ),
      };
    }

    if (event.type === 'text-delta') {
      return {
        assistantMessage: await this.appendAssistantPartDelta(
          assistantMessage,
          event.id,
          'text',
          event.text,
          context,
          {
            id: event.id,
            type: 'text',
            text: '',
            status: 'streaming',
            createdAt: this.now(),
            updatedAt: this.now(),
            providerMetadata: event.providerMetadata,
          },
        ),
      };
    }

    if (event.type === 'text-end') {
      return {
        assistantMessage: await this.patchPartStatus(
          assistantMessage,
          event.id,
          'complete',
          context,
        ),
      };
    }

    if (event.type === 'reasoning-start') {
      return {
        assistantMessage: await this.upsertAssistantPart(
          assistantMessage,
          {
            id: event.id,
            type: 'reasoning',
            text: '',
            status: 'streaming',
            createdAt: this.now(),
            updatedAt: this.now(),
            providerMetadata: event.providerMetadata,
          },
          context,
        ),
      };
    }

    if (event.type === 'reasoning-delta') {
      return {
        assistantMessage: await this.appendAssistantPartDelta(
          assistantMessage,
          event.id,
          'text',
          event.text,
          context,
          {
            id: event.id,
            type: 'reasoning',
            text: '',
            status: 'streaming',
            createdAt: this.now(),
            updatedAt: this.now(),
            providerMetadata: event.providerMetadata,
          },
        ),
      };
    }

    if (event.type === 'reasoning-end') {
      return {
        assistantMessage: await this.patchPartStatus(
          assistantMessage,
          event.id,
          'complete',
          context,
        ),
      };
    }

    if (event.type === 'tool-input-start') {
      return {
        assistantMessage: await this.upsertAssistantPart(
          assistantMessage,
          {
            id: event.id,
            type: 'tool-call',
            toolCallId: event.id,
            name: event.name,
            inputText: '',
            status: 'streaming',
            createdAt: this.now(),
            updatedAt: this.now(),
            providerMetadata: event.providerMetadata,
          },
          context,
        ),
      };
    }

    if (event.type === 'tool-input-delta') {
      return {
        assistantMessage: await this.appendAssistantPartDelta(
          assistantMessage,
          event.id,
          'inputText',
          event.text,
          context,
          {
            id: event.id,
            type: 'tool-call',
            toolCallId: event.id,
            name: event.name,
            inputText: '',
            status: 'streaming',
            createdAt: this.now(),
            updatedAt: this.now(),
            providerMetadata: event.providerMetadata,
          },
        ),
      };
    }

    if (event.type === 'tool-input-end') {
      return {
        assistantMessage: await this.patchPartStatus(
          assistantMessage,
          event.id,
          'pending',
          context,
        ),
      };
    }

    if (event.type === 'tool-call') {
      const next = await this.upsertAssistantPart(
        assistantMessage,
        {
          id: event.id,
          type: 'tool-call',
          toolCallId: event.id,
          name: event.name,
          input: event.input,
          inputText: stringifyUnknown(event.input),
          status: 'pending',
          createdAt: this.now(),
          updatedAt: this.now(),
          providerMetadata: event.providerMetadata,
        },
        context,
      );
      return {
        assistantMessage: next,
        toolCall: {
          id: event.id,
          name: event.name,
          input: event.input,
          providerMetadata: event.providerMetadata,
        },
      };
    }

    if (event.type === 'step-finish') {
      return {
        assistantMessage,
        usage: event.usage,
        finishReason: event.reason,
      };
    }

    if (event.type === 'finish') {
      return {
        assistantMessage,
        usage: event.usage,
        finishReason: event.reason,
      };
    }

    if (event.type === 'provider-error') {
      await this.publish(
        {
          type: 'run.error',
          conversationId: assistantMessage.conversationId,
          runId: context.runId ?? '',
          message: event.message,
          retryable: event.retryable,
        },
        context,
      );
      throw new Error(event.message);
    }

    return { assistantMessage };
  }

  private async executeTool(
    toolCall: AgenticToolCall,
    context: AgenticToolExecutionContext,
  ): Promise<AgenticToolExecutionResult> {
    const invalidInput = invalidToolInput(toolCall.input);
    if (invalidInput) {
      return invalidToolInputResult(toolCall, invalidInput);
    }

    if (!this.toolProvider) {
      return {
        toolCallId: toolCall.id,
        name: toolCall.name,
        result: `Tool provider is not configured for ${toolCall.name}`,
        isError: true,
      };
    }

    const timeoutMs =
      this.config?.toolExecutionTimeoutMs ??
      DEFAULT_AGENTIC_CHAT_CONFIG.toolExecutionTimeoutMs;
    const { context: executionContext, cleanup } = toolExecutionContext(
      context,
      timeoutMs,
    );

    try {
      return await withToolExecutionTimeout(
        this.toolProvider.executeTool(toolCall, executionContext),
        executionContext.signal,
      );
    } catch (error) {
      return {
        toolCallId: toolCall.id,
        name: toolCall.name,
        result: error instanceof Error ? error.message : String(error),
        isError: true,
      };
    } finally {
      cleanup();
    }
  }

  private async markToolCallComplete(
    assistantMessage: AgenticMessage,
    toolCallId: string,
    result: AgenticToolExecutionResult,
    context: AgenticEventContext,
  ): Promise<AgenticMessage> {
    const part = assistantMessage.parts.find(
      (candidate) =>
        candidate.type === 'tool-call' && candidate.toolCallId === toolCallId,
    );
    if (!part) return assistantMessage;

    return this.upsertAssistantPart(
      assistantMessage,
      {
        ...part,
        status: result.isError ? 'error' : 'complete',
        updatedAt: this.now(),
      },
      context,
    );
  }

  private async persistToolResultMessage({
    conversationId,
    runId,
    assistantMessageId,
    result,
    context,
  }: {
    conversationId: string;
    runId: string;
    assistantMessageId: string;
    result: AgenticToolExecutionResult;
    context: AgenticEventContext;
  }): Promise<void> {
    const now = this.now();
    const text = truncate(
      result.resultText ?? stringifyUnknown(result.result),
      this.config?.maxToolResultTextLength ??
        DEFAULT_AGENTIC_CHAT_CONFIG.maxToolResultTextLength,
    );
    const message: AgenticMessage = {
      id: this.createId('msg'),
      conversationId,
      role: 'tool',
      status: 'complete',
      parentMessageId: assistantMessageId,
      runId,
      parts: [
        {
          id: this.createId('part'),
          type: 'tool-result',
          toolCallId: result.toolCallId,
          name: result.name,
          result: result.result,
          resultText: text,
          isError: result.isError,
          status: result.isError ? 'error' : 'complete',
          createdAt: now,
          updatedAt: now,
          providerMetadata: result.providerMetadata,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    await this.repositories.messages.create(message);
    await this.publish(
      { type: 'message.upsert', conversationId, message },
      context,
    );
  }

  private async finalizeOrphanedToolCalls({
    assistantMessage,
    conversationId,
    runId,
    assistantMessageId,
    handledToolCallIds,
    context,
  }: {
    assistantMessage: AgenticMessage;
    conversationId: string;
    runId: string;
    assistantMessageId: string;
    handledToolCallIds: ReadonlySet<string>;
    context: AgenticEventContext;
  }): Promise<{ assistantMessage: AgenticMessage; count: number }> {
    let next = assistantMessage;
    let count = 0;

    for (const part of orphanedToolCallParts(
      assistantMessage,
      handledToolCallIds,
    )) {
      const result = incompleteToolCallResult(part);
      next = await this.markToolCallComplete(
        next,
        part.toolCallId,
        result,
        context,
      );
      await this.persistToolResultMessage({
        conversationId,
        runId,
        assistantMessageId,
        result,
        context,
      });
      count++;
    }

    return { assistantMessage: next, count };
  }

  private async upsertAssistantPart(
    assistantMessage: AgenticMessage,
    part: AgenticPart,
    context: AgenticEventContext,
  ): Promise<AgenticMessage> {
    const next = {
      ...assistantMessage,
      parts: upsertPart(assistantMessage.parts, part),
      updatedAt: this.now(),
    };

    await this.repositories.messages.upsertPart(
      next.conversationId,
      next.id,
      part,
    );
    await this.publish(
      {
        type: 'message.part.upsert',
        conversationId: next.conversationId,
        messageId: next.id,
        part,
      },
      context,
    );
    return next;
  }

  private async appendAssistantPartDelta(
    assistantMessage: AgenticMessage,
    partId: string,
    field: AgenticDeltaField,
    delta: string,
    context: AgenticEventContext,
    fallbackPart: AgenticPart,
  ): Promise<AgenticMessage> {
    let next = assistantMessage;
    if (!assistantMessage.parts.some((part) => part.id === partId)) {
      next = await this.upsertAssistantPart(
        assistantMessage,
        fallbackPart,
        context,
      );
    }

    next = {
      ...next,
      parts: appendPartDelta(next.parts, partId, field, delta),
      updatedAt: this.now(),
    };

    await this.repositories.messages.appendPartDelta(
      next.conversationId,
      next.id,
      partId,
      field,
      delta,
    );
    await this.publish(
      {
        type: 'message.part.delta',
        conversationId: next.conversationId,
        messageId: next.id,
        partId,
        field,
        delta,
      },
      context,
    );
    return next;
  }

  private async patchPartStatus(
    assistantMessage: AgenticMessage,
    partId: string,
    status: AgenticPart['status'],
    context: AgenticEventContext,
  ): Promise<AgenticMessage> {
    const part = assistantMessage.parts.find((item) => item.id === partId);
    if (!part) return assistantMessage;

    return this.upsertAssistantPart(
      assistantMessage,
      { ...part, status, updatedAt: this.now() },
      context,
    );
  }

  private async publish(
    event: AgenticEvent,
    context: AgenticEventContext,
  ): Promise<void> {
    await this.eventPublisher?.publish(event, context);
  }

  private createId(prefix: string): string {
    return this.idGenerator?.createId(prefix) ?? `${prefix}_${Date.now()}`;
  }

  private now(): string {
    return new Date().toISOString();
  }
}

function upsertPart(parts: AgenticPart[], part: AgenticPart): AgenticPart[] {
  const index = parts.findIndex((candidate) => candidate.id === part.id);
  if (index === -1) return [...parts, part];
  return [...parts.slice(0, index), part, ...parts.slice(index + 1)];
}

function appendPartDelta(
  parts: AgenticPart[],
  partId: string,
  field: AgenticDeltaField,
  delta: string,
): AgenticPart[] {
  return parts.map((part) =>
    part.id === partId
      ? ({
          ...part,
          [field]: `${String(
            (part as unknown as Record<string, unknown>)[field] ?? '',
          )}${delta}`,
          updatedAt: new Date().toISOString(),
        } as AgenticPart)
      : part,
  );
}

function filterStaleErroredToolInteractions(
  messages: AgenticMessage[],
  currentRunId: string,
): AgenticMessage[] {
  const staleErroredToolCallIds = new Set<string>();
  const staleErroredRunIds = new Set<string>();

  for (const message of messages) {
    if (message.runId === currentRunId || message.role !== 'tool') continue;

    for (const part of message.parts) {
      if (part.type === 'tool-result' && part.isError) {
        staleErroredToolCallIds.add(part.toolCallId);
        if (message.runId) staleErroredRunIds.add(message.runId);
      }
    }
  }

  if (!staleErroredToolCallIds.size) return messages;

  return messages.flatMap((message) => {
    if (message.runId === currentRunId) return [message];

    if (message.role === 'tool') {
      const parts = message.parts.filter(
        (part) =>
          part.type !== 'tool-result' ||
          !staleErroredToolCallIds.has(part.toolCallId),
      );
      if (!parts.length) return [];
      return parts.length === message.parts.length
        ? [message]
        : [{ ...message, parts }];
    }

    if (message.role === 'assistant') {
      const hasStaleErroredToolCall = message.parts.some(
        (part) =>
          part.type === 'tool-call' &&
          staleErroredToolCallIds.has(part.toolCallId),
      );

      if (
        hasStaleErroredToolCall &&
        message.runId &&
        staleErroredRunIds.has(message.runId)
      ) {
        return [];
      }

      const parts = message.parts.filter(
        (part) =>
          part.type !== 'tool-call' ||
          !staleErroredToolCallIds.has(part.toolCallId),
      );
      if (!parts.length) return [];
      return parts.length === message.parts.length
        ? [message]
        : [{ ...message, parts }];
    }

    return [message];
  });
}

function orphanedToolCallParts(
  message: AgenticMessage,
  handledToolCallIds: ReadonlySet<string>,
): AgenticToolCallPart[] {
  return message.parts.filter(
    (part): part is AgenticToolCallPart =>
      part.type === 'tool-call' &&
      !handledToolCallIds.has(part.toolCallId) &&
      (part.status === 'pending' || part.status === 'streaming'),
  );
}

function invalidToolInput(
  input: unknown,
): { raw?: unknown; parseError: string } | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return undefined;
  }

  const value = input as Record<string, unknown>;
  return typeof value._parseError === 'string'
    ? { raw: value._raw, parseError: value._parseError }
    : undefined;
}

function invalidToolInputResult(
  toolCall: AgenticToolCall,
  error: { raw?: unknown; parseError: string },
): AgenticToolExecutionResult {
  const result = {
    code: 'invalid_tool_arguments',
    message: `Invalid JSON tool arguments: ${error.parseError}`,
    raw: error.raw,
  };

  return {
    toolCallId: toolCall.id,
    name: toolCall.name,
    result,
    resultText: stringifyUnknown(result),
    isError: true,
    providerMetadata: toolCall.providerMetadata,
  };
}

function incompleteToolCallResult(
  part: AgenticToolCallPart,
): AgenticToolExecutionResult {
  const result = {
    code: 'incomplete_tool_call',
    message:
      'Tool call did not complete before the model step ended. The model may retry with complete JSON arguments.',
    inputText: part.inputText,
  };

  return {
    toolCallId: part.toolCallId,
    name: part.name,
    result,
    resultText: stringifyUnknown(result),
    isError: true,
    providerMetadata: part.providerMetadata,
  };
}

function maxModelStepsReachedToolResult(
  toolCall: AgenticToolCall,
): AgenticToolExecutionResult {
  const result = {
    code: 'max_model_steps_reached',
    message:
      'Tool call was not executed because the maximum number of model steps was reached.',
  };

  return {
    toolCallId: toolCall.id,
    name: toolCall.name,
    result,
    resultText: stringifyUnknown(result),
    isError: true,
    providerMetadata: toolCall.providerMetadata,
  };
}

function toolExecutionContext(
  context: AgenticToolExecutionContext,
  timeoutMs: number,
): { context: AgenticToolExecutionContext; cleanup: () => void } {
  const controller = new AbortController();
  const timeout =
    timeoutMs > 0
      ? setTimeout(() => {
          controller.abort(
            new Error(`Tool execution timed out after ${timeoutMs}ms`),
          );
        }, timeoutMs)
      : undefined;

  const abortFromParent = () => {
    controller.abort(
      context.signal?.reason ?? new Error('Tool execution aborted'),
    );
  };

  if (context.signal?.aborted) {
    abortFromParent();
  } else {
    context.signal?.addEventListener('abort', abortFromParent, { once: true });
  }

  return {
    context: {
      ...context,
      signal: controller.signal,
    },
    cleanup: () => {
      if (timeout) clearTimeout(timeout);
      context.signal?.removeEventListener('abort', abortFromParent);
    },
  };
}

function withToolExecutionTimeout<T>(
  execution: Promise<T>,
  signal: AbortSignal | undefined,
): Promise<T> {
  if (!signal) return execution;

  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abort);
      fn();
    };

    const abort = () => {
      settle(() => {
        const reason = signal.reason;
        reject(reason instanceof Error ? reason : new Error(String(reason)));
      });
    };

    if (signal.aborted) {
      abort();
      return;
    }

    signal.addEventListener('abort', abort, { once: true });
    execution.then(
      (value) => settle(() => resolve(value)),
      (error) => settle(() => reject(error)),
    );
  });
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2) ?? 'null';
  } catch {
    return String(value);
  }
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}\n... [truncated]`;
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' ||
      error.message === 'AbortError' ||
      error.message === 'The operation was aborted')
  );
}
