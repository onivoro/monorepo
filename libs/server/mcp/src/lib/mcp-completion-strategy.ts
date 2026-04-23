/**
 * Injectable strategy for argument autocompletion on resource templates and prompts.
 * Implement as an `@Injectable()` NestJS service with full DI access.
 *
 * Used with `McpResource({ completeStrategy: MyCompleter })` or
 * `McpPrompt({ completeStrategy: MyCompleter })`.
 *
 * The `argName` parameter identifies which URI variable or prompt argument
 * the client is requesting completions for.
 */
export interface McpCompletionStrategy {
  complete(argName: string, value: string, context?: { arguments?: Record<string, string> }): string[] | Promise<string[]>;
}
