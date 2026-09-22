/**
 * Builds the websocket room name carrying one conversation's agentic events.
 * Each app owns its own prefix (`formidavim:agentic:conversation:<id>`,
 * `rx:agentic:conversation:<id>`, ...), so the helpers below take the app's
 * factory rather than hard-coding a prefix.
 */
export type AgenticConversationRoomFactory = (conversationId: string) => string;

export function isAgenticConversationRoom(
  room: string,
  roomForConversation: AgenticConversationRoomFactory,
): boolean {
  return room.startsWith(roomForConversation(''));
}

/**
 * Returns the conversation id encoded in an agentic room name, or `undefined`
 * when the room belongs to another feature or carries an empty id.
 */
export function agenticConversationIdFromRoom(
  room: string,
  roomForConversation: AgenticConversationRoomFactory,
): string | undefined {
  const prefix = roomForConversation('');
  if (!room.startsWith(prefix)) return undefined;

  const conversationId = room.slice(prefix.length);
  return conversationId || undefined;
}
