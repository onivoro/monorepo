import type * as vscode from 'vscode';
import {
  COMMAND_HANDLER_METADATA,
  CommandHandlerMetadata,
} from './command-handler';
import { DiscoveredCommandHandler } from './discovered-command-handler';

/**
 * Registry for discovering and managing VSCode command handlers.
 *
 * This class scans provider instances for methods decorated with @CommandHandler
 * and provides utilities to register them with VSCode.
 *
 * @example
 * ```typescript
 * // In your extension activation
 * const registry = new CommandRegistry();
 *
 * // Add handler instances (typically from NestJS DI)
 * registry.addProvider(myCommandsService);
 * registry.addProvider(anotherService);
 *
 * // Register all discovered commands with VSCode
 * const disposables = registry.registerAll(context);
 * context.subscriptions.push(...disposables);
 * ```
 */
export class CommandRegistry {
  private handlers: DiscoveredCommandHandler[] = [];

  /**
   * Scan a provider instance for @CommandHandler decorated methods and add them.
   *
   * @param provider - An instance of a class containing @CommandHandler methods
   */
  addProvider(provider: object): void {
    if (!provider || typeof provider !== 'object') {
      return;
    }

    const prototype = Object.getPrototypeOf(provider);
    if (!prototype) {
      return;
    }

    const methodNames = Object.getOwnPropertyNames(prototype).filter(
      (name) => name !== 'constructor' && typeof prototype[name] === 'function',
    );

    for (const methodName of methodNames) {
      const methodRef = prototype[methodName];
      const metadata: CommandHandlerMetadata | undefined = Reflect.getMetadata(
        COMMAND_HANDLER_METADATA,
        methodRef,
      );

      if (metadata) {
        const handler = (provider as Record<string, unknown>)[methodName];
        if (typeof handler === 'function') {
          this.handlers.push({
            command: metadata.command,
            handler: handler.bind(provider),
          });
        }
      }
    }
  }

  /**
   * Get all discovered command handlers.
   */
  getHandlers(): DiscoveredCommandHandler[] {
    return [...this.handlers];
  }

  /**
   * Get all discovered command IDs.
   */
  getCommandIds(): string[] {
    return this.handlers.map((h) => h.command);
  }

  /**
   * Register all discovered handlers with VSCode.
   *
   * @param context - The VSCode extension context
   * @returns Array of disposables for the registered commands
   */
  registerAll(context: vscode.ExtensionContext): vscode.Disposable[] {
    // Import vscode dynamically to avoid issues at module load time
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const vscode = require('vscode') as typeof import('vscode');

    const disposables: vscode.Disposable[] = [];

    for (const { command, handler } of this.handlers) {
      const disposable = vscode.commands.registerCommand(command, handler);
      disposables.push(disposable);
    }

    const commandIds = this.getCommandIds();
    console.log(
      `[CommandRegistry] Registered ${commandIds.length} commands: ${commandIds.join(', ')}`,
    );

    return disposables;
  }

  /**
   * Register all discovered handlers and add them to the context subscriptions.
   *
   * @param context - The VSCode extension context
   */
  registerAllToContext(context: vscode.ExtensionContext): void {
    const disposables = this.registerAll(context);
    context.subscriptions.push(...disposables);
  }

  /**
   * Clear all registered handlers.
   */
  clear(): void {
    this.handlers = [];
  }
}
