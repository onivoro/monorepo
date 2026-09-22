import {
  AgenticMessage,
  AgenticModelRequest,
  AgenticPart,
  AgenticToolCallPart,
  AgenticToolDefinition,
  AgenticToolResultPart,
} from '@onivoro/isomorphic-agentic';
import {
  AgenticBedrockRequestDefaults,
  IAgenticBedrockProtocol,
} from './agentic-bedrock-protocol';
import { BedrockMessagesStreamParser } from './bedrock-messages-stream-parser';

export interface AnthropicTextBlock {
  type: 'text';
  text: string;
}

export interface AnthropicToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}

export interface AnthropicToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock;

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: AnthropicContentBlock[];
}

export interface AnthropicTool {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

export interface AnthropicMessagesRequestBody {
  anthropic_version: string;
  max_tokens: number;
  system?: string;
  messages: AnthropicMessage[];
  tools?: AnthropicTool[];
  temperature?: number;
  thinking?: unknown;
  output_config?: { effort?: string };
}

export function buildAnthropicMessagesRequestBody(
  request: AgenticModelRequest,
  defaults: AgenticBedrockRequestDefaults,
): AnthropicMessagesRequestBody {
  const { system, messages } = toAnthropicMessages(request);
  const combinedSystem = [request.system, system].filter(Boolean).join('\n\n');

  const body: AnthropicMessagesRequestBody = {
    anthropic_version: defaults.anthropicVersion,
    max_tokens: request.maxTokens ?? defaults.maxTokens,
    messages,
  };

  if (combinedSystem) body.system = combinedSystem;
  if (request.tools?.length) body.tools = request.tools.map(toAnthropicTool);

  // Sampling parameters are rejected with a 400 by current frontier models, so
  // this is opt-in even when the caller supplied a temperature.
  if (defaults.sendTemperature && request.temperature !== undefined) {
    body.temperature = request.temperature;
  }

  if (defaults.thinking !== undefined) body.thinking = defaults.thinking;
  if (defaults.effort !== undefined) {
    body.output_config = { effort: defaults.effort };
  }

  return body;
}

export function toAnthropicTool(tool: AgenticToolDefinition): AnthropicTool {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  };
}

/**
 * Maps the conversation onto the Anthropic Messages shape.
 *
 * Three rules do the work, and each one is a defect if skipped:
 *
 * - System and summary messages are lifted out into the top-level `system`
 *   field, because the Messages API has no system role inside `messages`.
 * - Tool results become `tool_result` blocks on a USER message, which is where
 *   the API expects them -- not on a message of role `tool`.
 * - Consecutive tool results are merged into ONE user message. The run loop
 *   persists a separate message per result, and sending them as separate user
 *   messages trains the model to stop making parallel tool calls.
 */
export function toAnthropicMessages(request: AgenticModelRequest): {
  system: string;
  messages: AnthropicMessage[];
} {
  const systemChunks: string[] = [];
  const messages: AnthropicMessage[] = [];

  for (const message of request.messages) {
    if (message.role === 'system' || message.role === 'summary') {
      const text = partText(message);
      if (text) systemChunks.push(text);
      continue;
    }

    if (message.role === 'tool') {
      const blocks = message.parts
        .filter(isToolResultPart)
        .map(toToolResultBlock);
      if (blocks.length) appendToUser(messages, blocks);
      continue;
    }

    if (message.role === 'assistant') {
      const blocks = toAssistantBlocks(message);
      if (blocks.length) messages.push({ role: 'assistant', content: blocks });
      continue;
    }

    const text = partText(message);
    if (text) appendToUser(messages, [{ type: 'text', text }]);
  }

  return {
    system: systemChunks.join('\n\n'),
    messages: dropLeadingAssistant(messages),
  };
}

function appendToUser(
  messages: AnthropicMessage[],
  blocks: AnthropicContentBlock[],
): void {
  const last = messages[messages.length - 1];
  if (last?.role === 'user') {
    last.content.push(...blocks);
    return;
  }
  messages.push({ role: 'user', content: blocks });
}

function toAssistantBlocks(message: AgenticMessage): AnthropicContentBlock[] {
  const blocks: AnthropicContentBlock[] = [];
  const text = partText(message);
  if (text) blocks.push({ type: 'text', text });

  for (const part of message.parts) {
    if (isToolCallWithInput(part)) {
      blocks.push({
        type: 'tool_use',
        id: part.toolCallId,
        name: part.name,
        input: part.input ?? {},
      });
    }
  }

  return blocks;
}

function toToolResultBlock(
  part: AgenticToolResultPart,
): AnthropicToolResultBlock {
  return {
    type: 'tool_result',
    tool_use_id: part.toolCallId,
    content: part.resultText ?? stringifyUnknown(part.result),
    ...(part.isError ? { is_error: true } : {}),
  };
}

/**
 * The Messages API requires the first message to be from the user. A
 * conversation can begin with an assistant turn after compaction dropped the
 * user message that preceded it.
 */
function dropLeadingAssistant(
  messages: AnthropicMessage[],
): AnthropicMessage[] {
  const first = messages.findIndex((message) => message.role === 'user');
  return first <= 0 ? messages : messages.slice(first);
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
 * The default protocol: the Anthropic Messages API as Bedrock exposes it.
 * Tool calls arrive as `tool_use` content blocks, so the parser's inline
 * marker scanning stays off.
 */
export const anthropicMessagesProtocol: IAgenticBedrockProtocol = {
  name: 'anthropic-messages',
  buildRequestBody: buildAnthropicMessagesRequestBody,
  createParser: (stepIndex) => new BedrockMessagesStreamParser(stepIndex),
};
