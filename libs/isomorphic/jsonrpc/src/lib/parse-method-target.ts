import { isMessageTarget, MessageTarget } from './message-target';

/**
 * Result of parsing a method string that may contain a routing target prefix.
 */
export interface ParsedMethod {
  /** The routing target extracted from the prefix, or null if none specified */
  target: MessageTarget | null;
  /** The method name with the target prefix removed */
  method: string;
  /** The original unparsed method string */
  original: string;
}

/**
 * The delimiter used to separate target prefix from method name.
 * Example: "server.health" uses "." as delimiter.
 */
export const METHOD_TARGET_DELIMITER = '.';

/**
 * Parses a method string to extract an optional routing target prefix.
 *
 * Method strings can optionally be prefixed with a target to indicate
 * where the message should be routed:
 * - "server.health" → target: "server", method: "health"
 * - "broadcast.user.updated" → target: "broadcast", method: "user.updated"
 * - "health" → target: null, method: "health"
 *
 * @param methodString - The full method string, possibly with target prefix
 * @returns Parsed result with target and method separated
 *
 * @example
 * parseMethodTarget('server.health')
 * // { target: 'server', method: 'health', original: 'server.health' }
 *
 * @example
 * parseMethodTarget('broadcast.user.created')
 * // { target: 'broadcast', method: 'user.created', original: 'broadcast.user.created' }
 *
 * @example
 * parseMethodTarget('health')
 * // { target: null, method: 'health', original: 'health' }
 */
export function parseMethodTarget(methodString: string): ParsedMethod {
  const delimiterIndex = methodString.indexOf(METHOD_TARGET_DELIMITER);

  // No delimiter found - no target prefix
  if (delimiterIndex === -1) {
    return {
      target: null,
      method: methodString,
      original: methodString,
    };
  }

  const potentialTarget = methodString.substring(0, delimiterIndex);

  // Check if the prefix is a valid target
  if (isMessageTarget(potentialTarget)) {
    return {
      target: potentialTarget,
      method: methodString.substring(delimiterIndex + 1),
      original: methodString,
    };
  }

  // Prefix exists but is not a valid target - treat whole string as method
  return {
    target: null,
    method: methodString,
    original: methodString,
  };
}

/**
 * Creates a method string with a target prefix.
 *
 * @param target - The routing target
 * @param method - The method name
 * @returns Combined string in "target.method" format
 *
 * @example
 * createTargetedMethod('server', 'health')
 * // 'server.health'
 */
export function createTargetedMethod(
  target: MessageTarget,
  method: string,
): string {
  return `${target}${METHOD_TARGET_DELIMITER}${method}`;
}

/**
 * Checks if a method string has a specific target prefix.
 *
 * @param methodString - The method string to check
 * @param target - The target to check for
 * @returns True if the method is targeted to the specified target
 *
 * @example
 * hasTarget('server.health', 'server') // true
 * hasTarget('server.health', 'webview') // false
 * hasTarget('health', 'server') // false
 */
export function hasTarget(
  methodString: string,
  target: MessageTarget,
): boolean {
  const parsed = parseMethodTarget(methodString);
  return parsed.target === target;
}

/**
 * Checks if a method should be routed to a specific target.
 * Returns true if the method is explicitly targeted to that target,
 * or if it's a broadcast.
 *
 * @param methodString - The method string to check
 * @param target - The target to check routing for
 * @returns True if the message should be routed to the target
 *
 * @example
 * shouldRouteToTarget('server.health', 'server') // true
 * shouldRouteToTarget('broadcast.update', 'server') // true
 * shouldRouteToTarget('broadcast.update', 'webview') // true
 * shouldRouteToTarget('server.health', 'webview') // false
 */
export function shouldRouteToTarget(
  methodString: string,
  target: MessageTarget,
): boolean {
  const parsed = parseMethodTarget(methodString);

  if (parsed.target === null) {
    return false;
  }

  if (parsed.target === MessageTarget.BROADCAST) {
    return true;
  }

  return parsed.target === target;
}
