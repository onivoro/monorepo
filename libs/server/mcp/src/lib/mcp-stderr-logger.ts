import { ConsoleLogger, LogLevel } from '@nestjs/common';

/**
 * A Nest `ConsoleLogger` that writes every level to stderr.
 *
 * A stdio MCP server's stdout carries JSON-RPC, and Nest's default logger writes `log`,
 * `warn`, `debug` and `verbose` to stdout, which corrupts that stream. `McpStdioModule`
 * installs this logger when it serves on `process.stdout`; pass it to `NestFactory` too
 * so the logs Nest writes while bootstrapping, before any module loads, also go to stderr:
 *
 * ```ts
 * await NestFactory.createApplicationContext(AppStdioModule, {
 *   logger: new McpStderrLogger(),
 * });
 * ```
 */
export class McpStderrLogger extends ConsoleLogger {
  protected override printMessages(
    messages: unknown[],
    context?: string,
    logLevel?: LogLevel,
  ): void {
    super.printMessages(messages, context, logLevel, 'stderr');
  }
}
