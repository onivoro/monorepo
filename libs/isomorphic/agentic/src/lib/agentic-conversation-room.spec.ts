import {
  agenticConversationIdFromRoom,
  isAgenticConversationRoom,
} from './agentic-conversation-room';

const roomForConversation = (conversationId: string) =>
  `formidavim:agentic:conversation:${conversationId}`;

describe('agentic conversation room helpers', () => {
  it('recognizes rooms built by the supplied factory', () => {
    expect(
      isAgenticConversationRoom(
        roomForConversation('abc'),
        roomForConversation,
      ),
    ).toBe(true);
  });

  it('rejects rooms belonging to another feature', () => {
    expect(isAgenticConversationRoom('flow:123', roomForConversation)).toBe(
      false,
    );
  });

  it('extracts the conversation id', () => {
    expect(
      agenticConversationIdFromRoom(
        roomForConversation('abc'),
        roomForConversation,
      ),
    ).toBe('abc');
  });

  it('returns undefined for a foreign room', () => {
    expect(
      agenticConversationIdFromRoom('flow:123', roomForConversation),
    ).toBeUndefined();
  });

  it('returns undefined when the room carries an empty id', () => {
    expect(
      agenticConversationIdFromRoom(
        roomForConversation(''),
        roomForConversation,
      ),
    ).toBeUndefined();
  });
});
