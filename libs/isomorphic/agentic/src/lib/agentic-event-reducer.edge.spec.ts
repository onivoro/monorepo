import {
  AgenticClientState,
  createEmptyAgenticClientState,
  reduceAgenticEvent,
} from './agentic-event-reducer';
import { AgenticMessage } from './agentic-message.types';

const conversationId = 'c1';

function message(input: Partial<AgenticMessage>): AgenticMessage {
  return {
    id: 'm1',
    conversationId,
    role: 'assistant',
    status: 'streaming',
    parts: [],
    createdAt: '2026-05-30T00:00:00.000Z',
    updatedAt: '2026-05-30T00:00:00.000Z',
    ...input,
  };
}

function withMessages(...messages: AgenticMessage[]): AgenticClientState {
  return messages.reduce(
    (state, m) =>
      reduceAgenticEvent(state, {
        type: 'message.upsert',
        conversationId,
        message: m,
      }),
    createEmptyAgenticClientState(),
  );
}

const ids = (state: AgenticClientState) =>
  state.messagesByConversationId[conversationId].map((m) => m.id);

describe('reduceAgenticEvent', () => {
  it('stores runs by id', () => {
    const run = {
      id: 'r1',
      conversationId,
      status: 'running' as const,
      startedAt: 't',
      updatedAt: 't',
    };
    const state = reduceAgenticEvent(createEmptyAgenticClientState(), {
      type: 'run.upsert',
      conversationId,
      run,
    });
    expect(state.runsById).toEqual({ r1: run });

    const updated = reduceAgenticEvent(state, {
      type: 'run.upsert',
      conversationId,
      run: { ...run, status: 'complete' },
    });
    expect(updated.runsById['r1'].status).toBe('complete');
    expect(state.runsById['r1'].status).toBe('running');
  });

  it('sorts new messages by createdAt, then role, then id', () => {
    const state = withMessages(
      message({ id: 'z', createdAt: '2026-05-30T00:00:02.000Z' }),
      message({ id: 'tool', role: 'tool' }),
      message({ id: 'b', role: 'assistant' }),
      message({ id: 'a', role: 'assistant' }),
      message({ id: 'user', role: 'user' }),
      message({ id: 'summary', role: 'summary' }),
      message({ id: 'other', role: 'mystery' as never }),
      message({ id: 'system', role: 'system' }),
      message({ id: 'first', createdAt: '2026-05-29T00:00:00.000Z' }),
    );
    expect(ids(state)).toEqual([
      'first',
      'summary',
      'system',
      'user',
      'a',
      'b',
      'tool',
      'other',
      'z',
    ]);
  });

  it('replaces an existing message in place without re-sorting', () => {
    const state = withMessages(message({ id: 'a' }), message({ id: 'b' }));
    const next = reduceAgenticEvent(state, {
      type: 'message.upsert',
      conversationId,
      message: message({ id: 'a', status: 'complete' }),
    });
    expect(ids(next)).toEqual(['a', 'b']);
    expect(next.messagesByConversationId[conversationId][0].status).toBe(
      'complete',
    );
  });

  it('removes messages, tolerating unknown conversations', () => {
    const state = withMessages(message({ id: 'a' }), message({ id: 'b' }));
    expect(
      ids(
        reduceAgenticEvent(state, {
          type: 'message.remove',
          conversationId,
          messageId: 'a',
        }),
      ),
    ).toEqual(['b']);

    const empty = reduceAgenticEvent(createEmptyAgenticClientState(), {
      type: 'message.remove',
      conversationId: 'nope',
      messageId: 'a',
    });
    expect(empty.messagesByConversationId['nope']).toEqual([]);
  });

  it('upserts parts by id', () => {
    const state = withMessages(
      message({
        id: 'a',
        parts: [{ id: 'p1', type: 'text', text: 'old' }],
      }),
      message({ id: 'b' }),
    );
    const replaced = reduceAgenticEvent(state, {
      type: 'message.part.upsert',
      conversationId,
      messageId: 'a',
      part: { id: 'p1', type: 'text', text: 'new' },
    });
    const appended = reduceAgenticEvent(replaced, {
      type: 'message.part.upsert',
      conversationId,
      messageId: 'a',
      part: { id: 'p2', type: 'reasoning', text: 'r' },
    });
    const [a, b] = appended.messagesByConversationId[conversationId];
    expect(a.parts).toEqual([
      { id: 'p1', type: 'text', text: 'new' },
      { id: 'p2', type: 'reasoning', text: 'r' },
    ]);
    expect(b.parts).toEqual([]);
  });

  it('creates a streaming text part when a delta targets an unknown part', () => {
    const state = withMessages(message({ id: 'a' }));
    const next = reduceAgenticEvent(state, {
      type: 'message.part.delta',
      conversationId,
      messageId: 'a',
      partId: 'p9',
      field: 'text',
      delta: 'hi',
    });
    expect(next.messagesByConversationId[conversationId][0].parts).toEqual([
      { id: 'p9', type: 'text', text: 'hi', status: 'streaming' },
    ]);
  });

  it('appends deltas to fields that start undefined', () => {
    const state = withMessages(
      message({
        id: 'a',
        parts: [{ id: 't', type: 'tool-call', toolCallId: 't', name: 'n' }],
      }),
    );
    const next = ['{"a"', ':1}'].reduce(
      (s, delta) =>
        reduceAgenticEvent(s, {
          type: 'message.part.delta',
          conversationId,
          messageId: 'a',
          partId: 't',
          field: 'inputText',
          delta,
        }),
      state,
    );
    expect(next.messagesByConversationId[conversationId][0].parts[0]).toEqual(
      expect.objectContaining({ inputText: '{"a":1}' }),
    );
  });

  it('part events for an unknown conversation yield an empty list', () => {
    const next = reduceAgenticEvent(createEmptyAgenticClientState(), {
      type: 'message.part.delta',
      conversationId: 'nope',
      messageId: 'a',
      partId: 'p',
      field: 'text',
      delta: 'x',
    });
    expect(next.messagesByConversationId['nope']).toEqual([]);
  });

  it('returns the same state for events it does not handle', () => {
    const state = createEmptyAgenticClientState();
    expect(
      reduceAgenticEvent(state, {
        type: 'run.error',
        conversationId,
        runId: 'r',
        message: 'x',
      }),
    ).toBe(state);
    expect(
      reduceAgenticEvent(state, {
        type: 'conversation.upsert',
        conversation: {} as never,
      }),
    ).toBe(state);
  });
});
