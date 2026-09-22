/**
 * Builds the router path for one agentic conversation. `basePath` is the app's
 * own agentic chat route, with or without a leading slash.
 */
export function buildAgenticConversationPath(
  basePath: string,
  conversationId: string,
): string {
  return `${basePath}/${encodeURIComponent(conversationId)}`;
}
