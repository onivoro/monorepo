/**
 * An error whose message is meant for the MCP client.
 *
 * When a tool handler, guard or interceptor throws one, `executeToolWrapped` returns its
 * message to the client in the `isError` result. Any other error is logged on the server
 * and the client only learns that the tool failed, so internal details don't leak.
 *
 * @example
 * throw new McpToolError(`No invoice with id ${params.id}`);
 */
export class McpToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McpToolError';
  }
}

/** Thrown when a guard rejects a tool call. */
export class McpAccessDeniedError extends McpToolError {
  constructor(
    message: string,
    /** The guard that rejected the call. */
    readonly guardName: string,
  ) {
    super(message);
    this.name = 'McpAccessDeniedError';
  }
}
