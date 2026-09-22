import {
  AgenticFinishReason,
  AgenticMessage,
  AgenticModelEvent,
  AgenticModelRequest,
  AgenticPart,
  AgenticToolArgumentStream,
  AgenticToolCallPart,
  AgenticToolDefinition,
  AgenticToolResultPart,
  AgenticUsage,
} from '@onivoro/isomorphic-agentic';
import { IAgenticBedrockProtocol } from './agentic-bedrock-protocol';
import { BedrockMessagesStreamParser } from './bedrock-messages-stream-parser';

export interface KimiK25MantleRequestBody {
  messages: KimiK25MantleMessage[];
  system?: string;
  tools?: KimiK25MantleTool[];
  max_tokens?: number;
  temperature?: number;
}

export interface KimiK25MantleMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface KimiK25MantleTool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

export function buildKimiK25MantleRequestBody(
  request: AgenticModelRequest,
): KimiK25MantleRequestBody {
  return {
    messages: [
      ...(request.system
        ? [{ role: 'system' as const, content: request.system }]
        : []),
      ...request.messages.flatMap(toKimiK25MantleMessages),
    ],
    tools: request.tools?.length
      ? request.tools.map(toKimiK25MantleTool)
      : undefined,
    max_tokens: request.maxTokens,
    temperature: request.temperature,
  };
}

export function toKimiK25MantleTool(
  tool: AgenticToolDefinition,
): KimiK25MantleTool {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  };
}

export function toKimiK25MantleMessages(
  message: AgenticMessage,
): KimiK25MantleMessage[] {
  if (message.role === 'summary') {
    return [{ role: 'system', content: partText(message) }];
  }

  if (message.role === 'tool') {
    return message.parts.filter(isToolResultPart).map((part) => ({
      role: 'tool' as const,
      tool_call_id: part.toolCallId,
      name: part.name,
      content: part.resultText ?? stringifyUnknown(part.result),
    }));
  }

  if (message.role === 'assistant') {
    const toolCalls = message.parts.filter(isToolCallWithInput).map((part) => ({
      id: part.toolCallId,
      type: 'function' as const,
      function: {
        name: part.name,
        arguments: stringifyUnknown(part.input),
      },
    }));

    return [
      {
        role: 'assistant',
        content: partText(message) || undefined,
        tool_calls: toolCalls.length ? toolCalls : undefined,
      },
    ];
  }

  return [
    {
      role: message.role === 'system' ? 'system' : 'user',
      content: partText(message),
    },
  ];
}

function isToolResultPart(part: AgenticPart): part is AgenticToolResultPart {
  return part.type === 'tool-result';
}

function isToolCallWithInput(part: AgenticPart): part is AgenticToolCallPart {
  return part.type === 'tool-call' && part.input !== undefined;
}

function partText(message: AgenticMessage): string {
  return message.parts
    .filter((part) => part.type === 'text' || part.type === 'reasoning')
    .map((part) => (part as { text?: string }).text ?? '')
    .join('');
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2) ?? 'null';
  } catch {
    return String(value);
  }
}

/**
 * Kimi K2.5 as exposed on Bedrock: an OpenAI-shaped request body, and a model
 * that emits tool calls as inline markers in the text stream rather than as
 * content blocks -- hence `nativeToolCallSyntax`.
 */
export const kimiK25MantleProtocol: IAgenticBedrockProtocol = {
  name: 'kimi-k25-mantle',
  buildRequestBody: (request, defaults) =>
    buildKimiK25MantleRequestBody({
      ...request,
      maxTokens: request.maxTokens ?? defaults.maxTokens,
    }),
  createParser: (stepIndex) =>
    new BedrockMessagesStreamParser(stepIndex, { nativeToolCallSyntax: true }),
};
