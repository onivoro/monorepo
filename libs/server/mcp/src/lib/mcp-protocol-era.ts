/**
 * Which MCP protocol generation a connection speaks.
 *
 * - `'modern'`: spec revision 2026-07-28. Stateless: every request carries the client's
 *   version and capabilities, there are no sessions, and the server never sends requests
 *   to the client (tools ask for input by returning `inputRequired(...)`).
 * - `'legacy'`: revisions 2025-11-25 and earlier, with the `initialize` handshake,
 *   sessions, and server-to-client requests.
 */
export type McpProtocolEra = 'legacy' | 'modern';
