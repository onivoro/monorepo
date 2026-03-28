import {
  Injectable,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { StdioLogParams, StdioLogLevel } from '@onivoro/server-stdio';
import { VSCODE_API } from './vscode-injection-tokens';
import { VscodeApi, VscodeOutputChannel } from './vscode-api-type';

/**
 * Configuration for the ServerOutputChannelService.
 */
export interface ServerOutputChannelConfig {
  /** Name for the output channel (shown in VSCode's Output panel) */
  channelName: string;
  /** Whether to show the output channel when an error is logged */
  showOnError?: boolean;
  /** Minimum log level to display (default: 'debug') */
  minLevel?: StdioLogLevel;
}

/**
 * Default configuration.
 */
const DEFAULT_CONFIG: Required<ServerOutputChannelConfig> = {
  channelName: 'Server',
  showOnError: true,
  minLevel: 'debug',
};

/**
 * Log level priority for filtering.
 */
const LOG_LEVEL_PRIORITY: Record<StdioLogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Injectable service that manages a VSCode OutputChannel for server logs.
 *
 * This service:
 * - Creates a dedicated OutputChannel for server process logs
 * - Formats and displays log messages with timestamps and levels
 * - Can auto-show the channel when errors occur
 *
 * @example
 * ```typescript
 * @Injectable()
 * class MyService {
 *   constructor(private readonly outputChannel: ServerOutputChannelService) {}
 *
 *   handleLog(log: StdioLogParams) {
 *     this.outputChannel.appendLog(log);
 *   }
 * }
 * ```
 */
@Injectable()
export class ServerOutputChannelService
  implements OnModuleInit, OnModuleDestroy
{
  private outputChannel: VscodeOutputChannel | null = null;
  private config: Required<ServerOutputChannelConfig>;

  constructor(
    @Inject(VSCODE_API) private readonly vscodeApi: VscodeApi,
    @Inject('SERVER_OUTPUT_CHANNEL_CONFIG')
    config?: ServerOutputChannelConfig,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  onModuleInit(): void {
    this.outputChannel = this.vscodeApi.window.createOutputChannel(
      this.config.channelName,
    );
  }

  onModuleDestroy(): void {
    if (this.outputChannel) {
      this.outputChannel.dispose();
      this.outputChannel = null;
    }
  }

  /**
   * Append a log message to the output channel.
   *
   * @param log - The log message from the server
   */
  appendLog(log: StdioLogParams): void {
    if (!this.outputChannel) {
      return;
    }

    // Check if log level meets minimum threshold
    if (
      LOG_LEVEL_PRIORITY[log.level] < LOG_LEVEL_PRIORITY[this.config.minLevel]
    ) {
      return;
    }

    const levelLabel = this.formatLevel(log.level);
    const timestamp = this.formatTimestamp(log.timestamp);
    const line = `${timestamp} ${levelLabel} ${log.message}`;

    this.outputChannel.appendLine(line);

    // Auto-show on error if configured
    if (log.level === 'error' && this.config.showOnError) {
      this.outputChannel.show(true); // true = preserve focus
    }
  }

  /**
   * Append a raw line to the output channel.
   */
  appendLine(line: string): void {
    this.outputChannel?.appendLine(line);
  }

  /**
   * Clear the output channel.
   */
  clear(): void {
    this.outputChannel?.clear();
  }

  /**
   * Show the output channel.
   *
   * @param preserveFocus - If true, don't move focus to the output panel
   */
  show(preserveFocus = true): void {
    this.outputChannel?.show(preserveFocus);
  }

  /**
   * Hide the output channel.
   */
  hide(): void {
    this.outputChannel?.hide();
  }

  /**
   * Get the underlying VSCode OutputChannel.
   */
  getChannel(): VscodeOutputChannel | null {
    return this.outputChannel;
  }

  private formatLevel(level: StdioLogLevel): string {
    switch (level) {
      case 'debug':
        return '[DEBUG]';
      case 'info':
        return '[INFO] ';
      case 'warn':
        return '[WARN] ';
      case 'error':
        return '[ERROR]';
      default:
        return '[LOG]  ';
    }
  }

  private formatTimestamp(isoTimestamp: string): string {
    try {
      const date = new Date(isoTimestamp);
      return date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
      });
    } catch {
      return isoTimestamp;
    }
  }
}
