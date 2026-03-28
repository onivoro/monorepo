import { StdioLogParams } from './stdio-log-message';

/**
 * Configuration for StdioServerProcess.
 */
export interface StdioServerProcessConfig {
  /** Timeout for requests in milliseconds (default: 30000) */
  requestTimeoutMs?: number;
  /** Handler for stderr output */
  onStderr?: (data: string) => void;
  /** Handler for process exit */
  onExit?: (code: number | null) => void;
  /** Handler for process errors */
  onError?: (error: Error) => void;
  /** Handler for log messages from the server process */
  onLog?: (log: StdioLogParams) => void;
}
