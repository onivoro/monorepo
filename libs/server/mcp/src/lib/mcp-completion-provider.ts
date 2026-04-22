/**
 * Injectable provider for argument autocompletion on resource templates and prompts.
 * Implement as an `@Injectable()` NestJS service with full DI access.
 *
 * Used with `McpResource({ completeProvider: MyCompleter })` or
 * `McpPrompt({ completeProvider: MyCompleter })`.
 *
 * The `argName` parameter identifies which URI variable or prompt argument
 * the client is requesting completions for.
 */
export interface McpCompletionProvider {
  complete(argName: string, value: string, context?: { arguments?: Record<string, string> }): string[] | Promise<string[]>;
}
