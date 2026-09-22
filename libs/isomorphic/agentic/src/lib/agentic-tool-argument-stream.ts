import { AgenticModelEvent } from './agentic-model-event.types';
import { AgenticProviderMetadata } from './json.types';

export type AgenticToolStreamKey = string | number;

export interface AgenticPendingToolInput {
  id: string;
  name: string;
  inputText: string;
  providerMetadata?: AgenticProviderMetadata;
}

export interface AgenticToolInputStart {
  id: string;
  name: string;
  inputText?: string;
  providerMetadata?: AgenticProviderMetadata;
}

export interface AgenticToolInputDelta {
  id?: string;
  name?: string;
  text: string;
  providerMetadata?: AgenticProviderMetadata;
}

export interface AgenticToolArgumentStreamResult<
  TKey extends AgenticToolStreamKey,
> {
  tools: ReadonlyMap<TKey, AgenticPendingToolInput>;
  tool?: AgenticPendingToolInput;
  events: AgenticModelEvent[];
}

export class AgenticToolArgumentStream<TKey extends AgenticToolStreamKey> {
  private readonly tools = new Map<TKey, AgenticPendingToolInput>();

  snapshot(): ReadonlyMap<TKey, AgenticPendingToolInput> {
    return new Map(this.tools);
  }

  start(
    key: TKey,
    tool: AgenticToolInputStart,
  ): AgenticToolArgumentStreamResult<TKey> {
    const current = this.tools.get(key);
    const next: AgenticPendingToolInput = {
      id: tool.id,
      name: tool.name,
      inputText: tool.inputText ?? current?.inputText ?? '',
      providerMetadata: tool.providerMetadata ?? current?.providerMetadata,
    };
    this.tools.set(key, next);

    if (current) {
      return { tools: this.snapshot(), tool: next, events: [] };
    }

    return {
      tools: this.snapshot(),
      tool: next,
      events: [
        {
          type: 'tool-input-start',
          id: next.id,
          name: next.name,
          providerMetadata: next.providerMetadata,
        },
      ],
    };
  }

  appendOrStart(
    key: TKey,
    delta: AgenticToolInputDelta,
  ): AgenticToolArgumentStreamResult<TKey> {
    const current = this.tools.get(key);
    const id = delta.id ?? current?.id;
    const name = delta.name ?? current?.name;

    if (!id || !name) {
      return {
        tools: this.snapshot(),
        events: [
          {
            type: 'provider-error',
            message: 'Tool argument delta is missing its tool identity',
            retryable: false,
          },
        ],
      };
    }

    const start = current
      ? { events: [] as AgenticModelEvent[] }
      : this.start(key, {
          id,
          name,
          providerMetadata: delta.providerMetadata,
        });
    const existing = this.tools.get(key);
    const next: AgenticPendingToolInput = {
      id,
      name,
      inputText: `${existing?.inputText ?? ''}${delta.text}`,
      providerMetadata: delta.providerMetadata ?? existing?.providerMetadata,
    };
    this.tools.set(key, next);

    return {
      tools: this.snapshot(),
      tool: next,
      events: [
        ...start.events,
        ...(delta.text.length
          ? [
              {
                type: 'tool-input-delta',
                id,
                name,
                text: delta.text,
                providerMetadata: next.providerMetadata,
              } satisfies AgenticModelEvent,
            ]
          : []),
      ],
    };
  }

  appendExisting(
    key: TKey,
    text: string,
  ): AgenticToolArgumentStreamResult<TKey> {
    const current = this.tools.get(key);
    if (!current) {
      return {
        tools: this.snapshot(),
        events: [
          {
            type: 'provider-error',
            message: 'Tool argument delta arrived before its start event',
            retryable: false,
          },
        ],
      };
    }

    if (!text.length) {
      return { tools: this.snapshot(), tool: current, events: [] };
    }

    const next = {
      ...current,
      inputText: `${current.inputText}${text}`,
    };
    this.tools.set(key, next);

    return {
      tools: this.snapshot(),
      tool: next,
      events: [
        {
          type: 'tool-input-delta',
          id: next.id,
          name: next.name,
          text,
          providerMetadata: next.providerMetadata,
        },
      ],
    };
  }

  finish(key: TKey): AgenticToolArgumentStreamResult<TKey> {
    const tool = this.tools.get(key);
    if (!tool) return { tools: this.snapshot(), events: [] };

    this.tools.delete(key);

    return {
      tools: this.snapshot(),
      tool,
      events: [
        {
          type: 'tool-input-end',
          id: tool.id,
          name: tool.name,
          providerMetadata: tool.providerMetadata,
        },
        {
          type: 'tool-call',
          id: tool.id,
          name: tool.name,
          input: parseToolInput(tool.inputText),
          providerMetadata: tool.providerMetadata,
        },
      ],
    };
  }

  finishAll(): AgenticToolArgumentStreamResult<TKey> {
    const events = Array.from(this.tools.keys()).flatMap(
      (key) => this.finish(key).events,
    );
    return { tools: this.snapshot(), events };
  }
}

export function parseToolInput(inputText: string): unknown {
  const trimmed = inputText.trim();
  if (!trimmed) return {};

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    return {
      _raw: inputText,
      _parseError:
        error instanceof Error ? error.message : 'Failed to parse JSON',
    };
  }
}
