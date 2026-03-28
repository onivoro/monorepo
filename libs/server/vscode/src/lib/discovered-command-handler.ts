/**
 * A discovered command handler entry.
 */
export interface DiscoveredCommandHandler {
  /** The command ID */
  command: string;
  /** The bound handler function */
  handler: (...args: unknown[]) => unknown | Promise<unknown>;
}
