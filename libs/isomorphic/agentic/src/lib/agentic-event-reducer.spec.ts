import {
  createEmptyAgenticClientState,
  reduceAgenticEvent,
} from './agentic-event-reducer';
import { AgenticMessage } from './agentic-message.types';

describe(reduceAgenticEvent.name, () => {
  it('orders messages deterministically when timestamps match', () => {
    const state = createEmptyAgenticClientState();
    const assistant = message({ id: 'message-2', role: 'assistant' });
    const user = message({ id: 'message-1', role: 'user' });

    const withAssistant = reduceAgenticEvent(state, {
      type: 'message.upsert',
      conversationId: 'conversation-1',
      message: assistant,
    });
    const withUser = reduceAgenticEvent(withAssistant, {
      type: 'message.upsert',
      conversationId: 'conversation-1',
      message: user,
    });

    expect(
      withUser.messagesByConversationId['conversation-1'].map(
        (item) => item.role,
      ),
    ).toEqual(['user', 'assistant']);
  });

  it('appends deltas to the matching message part', () => {
    const messageWithTextPart: AgenticMessage = message({
      id: 'message-1',
      role: 'assistant',
      parts: [{ id: 'part-1', type: 'text', text: '', status: 'streaming' }],
    });

    const withMessage = reduceAgenticEvent(createEmptyAgenticClientState(), {
      type: 'message.upsert',
      conversationId: 'conversation-1',
      message: messageWithTextPart,
    });

    const next = reduceAgenticEvent(withMessage, {
      type: 'message.part.delta',
      conversationId: 'conversation-1',
      messageId: 'message-1',
      partId: 'part-1',
      field: 'text',
      delta: 'hello',
    });

    expect(
      next.messagesByConversationId['conversation-1'][0].parts[0],
    ).toMatchObject({ text: 'hello' });
  });
});

function message(input: Partial<AgenticMessage>): AgenticMessage {
  return {
    id: 'message-1',
    conversationId: 'conversation-1',
    role: 'assistant',
    status: 'streaming',
    parts: [],
    createdAt: '2026-05-30T00:00:00.000Z',
    updatedAt: '2026-05-30T00:00:00.000Z',
    ...input,
  };
}
