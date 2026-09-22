import { AgenticRun } from './agentic-conversation.types';
import { AgenticEvent } from './agentic-event.types';
import { AgenticMessage } from './agentic-message.types';
import {
  AgenticDeltaField,
  AgenticPart,
  AgenticTextPart,
} from './agentic-part.types';

export interface AgenticClientState {
  messagesByConversationId: Record<string, AgenticMessage[]>;
  runsById: Record<string, AgenticRun>;
}

export const createEmptyAgenticClientState = (): AgenticClientState => ({
  messagesByConversationId: {},
  runsById: {},
});

export function reduceAgenticEvent(
  state: AgenticClientState,
  event: AgenticEvent,
): AgenticClientState {
  if (event.type === 'run.upsert') {
    return {
      ...state,
      runsById: {
        ...state.runsById,
        [event.run.id]: event.run,
      },
    };
  }

  if (event.type === 'message.upsert') {
    return {
      ...state,
      messagesByConversationId: {
        ...state.messagesByConversationId,
        [event.conversationId]: upsertMessage(
          state.messagesByConversationId[event.conversationId] ?? [],
          event.message,
        ),
      },
    };
  }

  if (event.type === 'message.remove') {
    return {
      ...state,
      messagesByConversationId: {
        ...state.messagesByConversationId,
        [event.conversationId]: (
          state.messagesByConversationId[event.conversationId] ?? []
        ).filter((message) => message.id !== event.messageId),
      },
    };
  }

  if (event.type === 'message.part.upsert') {
    return updateMessageParts(
      state,
      event.conversationId,
      event.messageId,
      (parts) => upsertPart(parts, event.part),
    );
  }

  if (event.type === 'message.part.delta') {
    return updateMessageParts(
      state,
      event.conversationId,
      event.messageId,
      (parts) => appendPartDelta(parts, event.partId, event.field, event.delta),
    );
  }

  return state;
}

function upsertMessage(
  messages: AgenticMessage[],
  message: AgenticMessage,
): AgenticMessage[] {
  const index = messages.findIndex((item) => item.id === message.id);
  if (index === -1) {
    return [...messages, message].sort(compareMessagesChronologically);
  }

  return [...messages.slice(0, index), message, ...messages.slice(index + 1)];
}

function compareMessagesChronologically(
  a: AgenticMessage,
  b: AgenticMessage,
): number {
  const createdAt = a.createdAt.localeCompare(b.createdAt);
  if (createdAt !== 0) return createdAt;
  const role = roleOrder(a.role) - roleOrder(b.role);
  if (role !== 0) return role;
  return a.id.localeCompare(b.id);
}

function roleOrder(role: AgenticMessage['role']): number {
  if (role === 'system' || role === 'summary') return 0;
  if (role === 'user') return 1;
  if (role === 'assistant') return 2;
  if (role === 'tool') return 3;
  return 4;
}

function updateMessageParts(
  state: AgenticClientState,
  conversationId: string,
  messageId: string,
  update: (parts: AgenticPart[]) => AgenticPart[],
): AgenticClientState {
  const messages = state.messagesByConversationId[conversationId] ?? [];
  return {
    ...state,
    messagesByConversationId: {
      ...state.messagesByConversationId,
      [conversationId]: messages.map((message) =>
        message.id === messageId
          ? { ...message, parts: update(message.parts) }
          : message,
      ),
    },
  };
}

function upsertPart(parts: AgenticPart[], part: AgenticPart): AgenticPart[] {
  const index = parts.findIndex((item) => item.id === part.id);
  if (index === -1) return [...parts, part];
  return [...parts.slice(0, index), part, ...parts.slice(index + 1)];
}

function appendPartDelta(
  parts: AgenticPart[],
  partId: string,
  field: AgenticDeltaField,
  delta: string,
): AgenticPart[] {
  const existing = parts.find((part) => part.id === partId);
  const part =
    existing ??
    ({
      id: partId,
      type: 'text',
      text: '',
      status: 'streaming',
    } satisfies AgenticTextPart);

  const value = String(
    (part as unknown as Record<string, unknown>)[field] ?? '',
  );
  return upsertPart(parts, {
    ...part,
    [field]: `${value}${delta}`,
  } as AgenticPart);
}
