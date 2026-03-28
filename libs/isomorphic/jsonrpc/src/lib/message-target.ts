/**
 * Targets for message routing in a multi-process architecture.
 * Used to determine where a message should be delivered.
 */
export const MessageTarget = {
  /** Route to the stdio server process */
  SERVER: 'server',
  /** Route to the webview/browser process */
  WEBVIEW: 'webview',
  /** Route to the VSCode extension host */
  EXTENSION: 'extension',
  /** Broadcast to all targets */
  BROADCAST: 'broadcast',
} as const;

export type MessageTarget = (typeof MessageTarget)[keyof typeof MessageTarget];

/**
 * Array of all valid message targets for iteration/validation.
 */
export const MESSAGE_TARGETS: readonly MessageTarget[] = [
  MessageTarget.SERVER,
  MessageTarget.WEBVIEW,
  MessageTarget.EXTENSION,
  MessageTarget.BROADCAST,
] as const;

/**
 * Type guard to check if a string is a valid MessageTarget.
 */
export function isMessageTarget(value: string): value is MessageTarget {
  return MESSAGE_TARGETS.includes(value as MessageTarget);
}
