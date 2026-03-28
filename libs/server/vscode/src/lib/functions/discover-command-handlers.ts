import { CommandRegistry } from '../command-registry';

/**
 * Discover command handlers from multiple provider instances.
 *
 * @param providers - Array of provider instances to scan
 * @returns CommandRegistry populated with discovered handlers
 *
 * @example
 * ```typescript
 * const registry = discoverCommandHandlers([
 *   myCommandsService,
 *   fileCommandsService,
 *   editCommandsService,
 * ]);
 *
 * registry.registerAllToContext(context);
 * ```
 */
export function discoverCommandHandlers(providers: object[]): CommandRegistry {
  const registry = new CommandRegistry();
  for (const provider of providers) {
    registry.addProvider(provider);
  }
  return registry;
}
