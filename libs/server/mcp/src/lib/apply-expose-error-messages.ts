import type { Logger } from '@nestjs/common';
import type { McpToolRegistry } from './mcp-tool-registry';

/**
 * Applies a module's `exposeErrorMessages` setting to the registry. Left unset, messages are
 * exposed (this release's default) and a warning says the default is changing.
 */
export function applyExposeErrorMessages(
  registry: McpToolRegistry,
  exposeErrorMessages: boolean | undefined,
  logger: Pick<Logger, 'warn'>,
): void {
  registry.setExposeErrorMessages(exposeErrorMessages ?? true);
  if (exposeErrorMessages === undefined) {
    logger.warn(
      'exposeErrorMessages is not set, so clients see the message of any error a tool throws, which can leak internal details. ' +
        'The default becomes false in the next major release, when only McpToolError messages and argument validation errors reach clients. ' +
        'Set exposeErrorMessages explicitly to keep your choice and silence this warning.',
    );
  }
}
