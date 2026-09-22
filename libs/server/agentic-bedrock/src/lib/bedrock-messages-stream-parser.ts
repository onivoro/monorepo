import {
  AgenticFinishReason,
  AgenticMessage,
  AgenticModelEvent,
  AgenticPart,
  AgenticToolArgumentStream,
  AgenticToolCallPart,
  AgenticToolResultPart,
  AgenticUsage,
} from '@onivoro/isomorphic-agentic';

function isToolResultPart(part: AgenticPart): part is AgenticToolResultPart {
  return part.type === 'tool-result';
}

function isToolCallWithInput(part: AgenticPart): part is AgenticToolCallPart {
  return part.type === 'tool-call' && part.input !== undefined;
}

export interface BedrockMessagesStreamParserOptions {
  /**
   * Scan assistant text for inline tool-call markers.
   *
   * Some models emit tool calls inside the text stream rather than as
   * `tool_use` content blocks. Detecting that means holding back any text that
   * could be the start of a marker, which costs a little streaming latency --
   * so it is off unless the protocol asks for it. Models that emit proper
   * `tool_use` blocks (Claude among them) never need it.
   */
  nativeToolCallSyntax?: boolean;
}

export class BedrockMessagesStreamParser {
  private readonly tools = new AgenticToolArgumentStream<number>();
  private readonly openText = new Set<string>();
  private readonly openReasoning = new Set<string>();
  private nativeToolTextBuffer = '';
  private nativeToolTextId: string | undefined;
  private nativeToolSequence = 0;
  private finished = false;
  private lastFinishReason: AgenticFinishReason = 'stop';
  private lastUsage: AgenticUsage | undefined;

  constructor(
    private readonly stepIndex = 0,
    private readonly options: BedrockMessagesStreamParserOptions = {},
  ) {}

  parse(chunk: unknown): AgenticModelEvent[] {
    const event = asRecord(chunk);
    const type = asString(event.type);

    if (type === 'content_block_start') {
      return this.onContentBlockStart(event);
    }

    if (type === 'content_block_delta') {
      return this.onContentBlockDelta(event);
    }

    if (type === 'content_block_stop') {
      return this.onContentBlockStop(event);
    }

    if (type === 'message_delta') {
      return this.onMessageDelta(event);
    }

    if (type === 'message_stop') {
      return this.finish();
    }

    if (asArray(event.choices).length) {
      return this.onOpenAiChatChunk(event);
    }

    if (type === 'error') {
      return [
        {
          type: 'provider-error',
          message:
            asString(asRecord(event.error).message) ?? 'Bedrock stream error',
          retryable: false,
          providerMetadata: { bedrock: chunk },
        },
      ];
    }

    return [];
  }

  finish(): AgenticModelEvent[] {
    if (this.finished) return [];
    this.finished = true;

    const events: AgenticModelEvent[] = [];
    events.push(...this.flushNativeToolTextBuffer());
    for (const id of this.openText) events.push({ type: 'text-end', id });
    for (const id of this.openReasoning) {
      events.push({ type: 'reasoning-end', id });
    }
    events.push(...this.tools.finishAll().events);
    events.push({
      type: 'step-finish',
      index: this.stepIndex,
      reason: this.lastFinishReason,
      usage: this.lastUsage,
    });
    events.push({
      type: 'finish',
      reason: this.lastFinishReason,
      usage: this.lastUsage,
    });
    return events;
  }

  private onContentBlockStart(
    event: Record<string, unknown>,
  ): AgenticModelEvent[] {
    const index = contentBlockIndex(event);
    const block = asRecord(event.content_block ?? event.contentBlock);
    const blockType = asString(block.type);

    if (blockType === 'tool_use' || blockType === 'server_tool_use') {
      return this.tools.start(index, {
        id:
          asString(block.id) ?? asString(block.tool_use_id) ?? `tool-${index}`,
        name: asString(block.name) ?? `tool-${index}`,
        inputText:
          block.input === undefined ? undefined : stringifyUnknown(block.input),
        providerMetadata: { bedrock: event },
      }).events;
    }

    return [];
  }

  private onContentBlockDelta(
    event: Record<string, unknown>,
  ): AgenticModelEvent[] {
    const index = contentBlockIndex(event);
    const delta = asRecord(event.delta);
    const events: AgenticModelEvent[] = [];
    const text = asString(delta.text);
    const reasoningText =
      asString(delta.reasoning) ??
      asString(delta.thinking) ??
      asString(asRecord(delta.reasoningContent).text);
    const partialJson =
      asString(delta.partial_json) ??
      asString(asRecord(delta.tool_use ?? delta.toolUse).input) ??
      asString(asRecord(delta.function_call ?? delta.functionCall).arguments);

    if (text) {
      const id = `text-${index}`;
      events.push(...this.onTextContent(id, text, event));
    }

    if (reasoningText) {
      const id = `reasoning-${index}`;
      if (!this.openReasoning.has(id)) {
        this.openReasoning.add(id);
        events.push({ type: 'reasoning-start', id });
      }
      events.push({ type: 'reasoning-delta', id, text: reasoningText });
    }

    if (partialJson) {
      events.push(...this.tools.appendExisting(index, partialJson).events);
    }

    return events;
  }

  private onContentBlockStop(
    event: Record<string, unknown>,
  ): AgenticModelEvent[] {
    const index = contentBlockIndex(event);
    const events: AgenticModelEvent[] = [];
    const textId = `text-${index}`;
    const reasoningId = `reasoning-${index}`;

    if (this.openText.delete(textId)) {
      events.push({ type: 'text-end', id: textId });
    }
    if (this.openReasoning.delete(reasoningId)) {
      events.push({ type: 'reasoning-end', id: reasoningId });
    }
    events.push(...this.tools.finish(index).events);
    return events;
  }

  private onMessageDelta(event: Record<string, unknown>): AgenticModelEvent[] {
    const delta = asRecord(event.delta);
    this.lastFinishReason = normalizeFinishReason(
      asString(delta.stop_reason) ?? asString(delta.stopReason),
    );
    this.lastUsage = usageFromRaw(event.usage ?? delta.usage);
    return [];
  }

  private onOpenAiChatChunk(
    event: Record<string, unknown>,
  ): AgenticModelEvent[] {
    const events: AgenticModelEvent[] = [];

    for (const [choiceOffset, rawChoice] of asArray(event.choices).entries()) {
      const choice = asRecord(rawChoice);
      const choiceIndex = asNumber(choice.index) ?? choiceOffset;
      const delta = asRecord(choice.delta);
      const text = asString(delta.content);
      const reasoningText =
        asString(delta.reasoning_content) ??
        asString(delta.reasoningContent) ??
        asString(delta.reasoning);

      if (text) {
        const id = `text-${choiceIndex}`;
        events.push(...this.onTextContent(id, text, event));
      }

      if (reasoningText) {
        const id = `reasoning-${choiceIndex}`;
        if (!this.openReasoning.has(id)) {
          this.openReasoning.add(id);
          events.push({ type: 'reasoning-start', id });
        }
        events.push({ type: 'reasoning-delta', id, text: reasoningText });
      }

      events.push(...this.onOpenAiToolCalls(delta, event));

      const finishReason = asString(choice.finish_reason);
      if (finishReason) {
        this.lastFinishReason = normalizeFinishReason(finishReason);
      }
    }

    this.lastUsage = usageFromRaw(
      event.usage ??
        event.amazonBedrockInvocationMetrics ??
        event['amazon-bedrock-invocationMetrics'],
    );
    return events;
  }

  private onOpenAiToolCalls(
    delta: Record<string, unknown>,
    event: Record<string, unknown>,
  ): AgenticModelEvent[] {
    const events: AgenticModelEvent[] = [];

    for (const [toolOffset, rawToolCall] of asArray(
      delta.tool_calls,
    ).entries()) {
      const toolCall = asRecord(rawToolCall);
      const index = asNumber(toolCall.index) ?? toolOffset;
      const fn = asRecord(toolCall.function);
      const id = asString(toolCall.id);
      const name = asString(fn.name);
      const argumentsDelta = asString(fn.arguments) ?? '';

      if (id || name) {
        events.push(
          ...this.tools.start(index, {
            id: id ?? `tool-${index}`,
            name: name ?? `tool-${index}`,
            providerMetadata: { bedrock: event },
          }).events,
        );
      }

      if (argumentsDelta) {
        events.push(
          ...this.tools.appendOrStart(index, {
            id,
            name,
            text: argumentsDelta,
            providerMetadata: { bedrock: event },
          }).events,
        );
      }
    }

    return events;
  }

  private onTextContent(
    id: string,
    text: string,
    event: Record<string, unknown>,
  ): AgenticModelEvent[] {
    // Straight through unless this protocol expects inline tool-call markers.
    // The buffering below holds back any suffix that could begin one, which is
    // pure added latency for a model that emits real tool_use blocks.
    if (!this.options.nativeToolCallSyntax) {
      return this.textDelta(id, text);
    }

    const events: AgenticModelEvent[] = [];

    if (this.nativeToolTextId && this.nativeToolTextId !== id) {
      events.push(...this.flushNativeToolTextBuffer());
    }

    this.nativeToolTextId = id;
    this.nativeToolTextBuffer += text;
    events.push(...this.drainNativeToolTextBuffer(id, event));

    return events;
  }

  private drainNativeToolTextBuffer(
    id: string,
    event: Record<string, unknown>,
    final = false,
  ): AgenticModelEvent[] {
    const events: AgenticModelEvent[] = [];

    while (this.nativeToolTextBuffer) {
      const sectionStart = this.nativeToolTextBuffer.indexOf(
        KIMI_TOOL_SECTION_BEGIN,
      );

      if (sectionStart >= 0) {
        const before = this.nativeToolTextBuffer.slice(0, sectionStart);
        if (before) events.push(...this.textDelta(id, before));

        this.nativeToolTextBuffer =
          this.nativeToolTextBuffer.slice(sectionStart);
        const sectionEnd = this.nativeToolTextBuffer.indexOf(
          KIMI_TOOL_SECTION_END,
        );

        if (sectionEnd < 0) {
          if (final) {
            events.push(...this.textDelta(id, this.nativeToolTextBuffer));
            this.nativeToolTextBuffer = '';
          }
          return events;
        }

        const section = this.nativeToolTextBuffer.slice(
          0,
          sectionEnd + KIMI_TOOL_SECTION_END.length,
        );
        const toolEvents = this.parseNativeToolCallSection(section);

        if (toolEvents.length) {
          events.push(...toolEvents);
          this.lastFinishReason = 'tool-calls';
          this.nativeToolTextBuffer = this.nativeToolTextBuffer.slice(
            sectionEnd + KIMI_TOOL_SECTION_END.length,
          );
          continue;
        }

        events.push(...this.textDelta(id, section));
        this.nativeToolTextBuffer = this.nativeToolTextBuffer.slice(
          sectionEnd + KIMI_TOOL_SECTION_END.length,
        );
        continue;
      }

      const heldLength = final
        ? 0
        : suffixPrefixLength(
            this.nativeToolTextBuffer,
            KIMI_TOOL_SECTION_BEGIN,
          );
      const emitLength = this.nativeToolTextBuffer.length - heldLength;

      if (emitLength <= 0) {
        return events;
      }

      events.push(
        ...this.textDelta(id, this.nativeToolTextBuffer.slice(0, emitLength)),
      );
      this.nativeToolTextBuffer = this.nativeToolTextBuffer.slice(emitLength);
    }

    return events;
  }

  private flushNativeToolTextBuffer(): AgenticModelEvent[] {
    if (!this.nativeToolTextBuffer) return [];
    return this.drainNativeToolTextBuffer(
      this.nativeToolTextId ?? 'text-0',
      {},
      true,
    );
  }

  private textDelta(id: string, text: string): AgenticModelEvent[] {
    if (!text) return [];

    const events: AgenticModelEvent[] = [];
    if (!this.openText.has(id)) {
      this.openText.add(id);
      events.push({ type: 'text-start', id });
    }
    events.push({ type: 'text-delta', id, text });
    return events;
  }

  private parseNativeToolCallSection(section: string): AgenticModelEvent[] {
    const events: AgenticModelEvent[] = [];
    const calls = parseKimiNativeToolCalls(section);

    for (const call of calls) {
      const key = 10_000 + this.nativeToolSequence++;
      const id = `tool-${this.stepIndex}-${key}`;
      events.push(
        ...this.tools.start(key, {
          id,
          name: call.name,
          providerMetadata: {
            bedrock: { nativeToolCallSyntax: true },
          },
        }).events,
      );
      events.push(...this.tools.appendExisting(key, call.argumentsText).events);
      events.push(...this.tools.finish(key).events);
    }

    return events;
  }
}

const KIMI_TOOL_SECTION_BEGIN = '<|tool_calls_section_begin|>';
const KIMI_TOOL_SECTION_END = '<|tool_calls_section_end|>';
const KIMI_TOOL_CALL_BEGIN = '<|tool_call_begin|>';
const KIMI_TOOL_ARGUMENT_BEGIN = '<|tool_call_argument_begin|>';
const KIMI_TOOL_CALL_END = '<|tool_call_end|>';

interface KimiNativeToolCall {
  name: string;
  argumentsText: string;
}

function parseKimiNativeToolCalls(section: string): KimiNativeToolCall[] {
  const calls: KimiNativeToolCall[] = [];
  let offset = 0;

  while (offset < section.length) {
    const callStart = section.indexOf(KIMI_TOOL_CALL_BEGIN, offset);
    if (callStart < 0) break;

    const nameStart = callStart + KIMI_TOOL_CALL_BEGIN.length;
    const argsStart = section.indexOf(KIMI_TOOL_ARGUMENT_BEGIN, nameStart);
    if (argsStart < 0) break;

    const argsTextStart = argsStart + KIMI_TOOL_ARGUMENT_BEGIN.length;
    const callEnd = section.indexOf(KIMI_TOOL_CALL_END, argsTextStart);
    if (callEnd < 0) break;

    const name = normalizeKimiNativeToolName(
      section.slice(nameStart, argsStart),
    );
    if (name) {
      calls.push({
        name,
        argumentsText: section.slice(argsTextStart, callEnd).trim(),
      });
    }

    offset = callEnd + KIMI_TOOL_CALL_END.length;
  }

  return calls;
}

function normalizeKimiNativeToolName(rawName: string): string {
  return rawName
    .trim()
    .replace(/^functions?\./, '')
    .replace(/^function\./, '')
    .replace(/!$/, '')
    .replace(/:\d+$/, '')
    .trim();
}

function suffixPrefixLength(value: string, prefix: string): number {
  const maxLength = Math.min(value.length, prefix.length - 1);

  for (let length = maxLength; length > 0; length--) {
    if (prefix.startsWith(value.slice(-length))) {
      return length;
    }
  }

  return 0;
}

export function extractKimiK25MantleText(body: unknown): string {
  const value = asRecord(body);
  const choice = asRecord(asArray(value.choices)[0]);
  const choiceMessage = asRecord(choice.message);
  const content = choiceMessage.content ?? value.content;

  if (typeof content === 'string') return content.trim();

  const contentArray = asArray(content);
  if (contentArray.length) {
    return contentArray
      .map((item) => asString(asRecord(item).text) ?? '')
      .join('')
      .trim();
  }

  const outputMessage = asRecord(asRecord(value.output).message);
  const outputContent = asArray(outputMessage.content);
  return outputContent
    .map((item) => asString(asRecord(item).text) ?? '')
    .join('')
    .trim();
}

function partText(message: AgenticMessage): string {
  return message.parts
    .map((part) => {
      if (part.type === 'text' || part.type === 'summary') return part.text;
      if (part.type === 'reasoning') return part.text;
      if (part.type === 'file') return part.uri ?? part.name;
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

function usageFromRaw(raw: unknown): AgenticUsage | undefined {
  const usage = asRecord(raw);
  if (!Object.keys(usage).length) return undefined;

  const inputTokens =
    asNumber(usage.input_tokens) ??
    asNumber(usage.prompt_tokens) ??
    asNumber(usage.inputTokens) ??
    asNumber(usage.inputTokenCount);
  const outputTokens =
    asNumber(usage.output_tokens) ??
    asNumber(usage.completion_tokens) ??
    asNumber(usage.outputTokens) ??
    asNumber(usage.outputTokenCount);
  const totalTokens =
    asNumber(usage.total_tokens) ??
    asNumber(usage.totalTokens) ??
    (inputTokens !== undefined && outputTokens !== undefined
      ? inputTokens + outputTokens
      : undefined);

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    cacheReadInputTokens: asNumber(usage.cache_read_input_tokens),
    cacheWriteInputTokens: asNumber(usage.cache_creation_input_tokens),
    providerMetadata: { bedrock: raw },
  };
}

function normalizeFinishReason(reason?: string): AgenticFinishReason {
  if (!reason) return 'unknown';
  if (
    reason === 'end_turn' ||
    reason === 'stop_sequence' ||
    reason === 'stop'
  ) {
    return 'stop';
  }
  if (reason === 'max_tokens' || reason === 'length') return 'length';
  if (reason === 'tool_use' || reason === 'tool_calls') return 'tool-calls';
  if (reason === 'content_filter') return 'content-filter';
  return 'unknown';
}

function contentBlockIndex(event: Record<string, unknown>): number {
  return (
    asNumber(event.index) ??
    asNumber(event.content_block_index) ??
    asNumber(event.contentBlockIndex) ??
    0
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value ?? null) ?? 'null';
  } catch {
    return String(value);
  }
}
