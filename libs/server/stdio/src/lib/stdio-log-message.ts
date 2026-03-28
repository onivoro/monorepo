import { JsonRpcNotification, JSONRPC_VERSION } from '@onivoro/isomorphic-jsonrpc';

export const STDIO_LOG_METHOD = 'log' as const;

export type StdioLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface StdioLogParams {
  level: StdioLogLevel;
  message: string;
  timestamp: string;
}

export type StdioLogNotification = JsonRpcNotification<StdioLogParams> & {
  method: typeof STDIO_LOG_METHOD;
  params: StdioLogParams;
};

export function isStdioLogNotification(
  message: unknown,
): message is StdioLogNotification {
  return (
    typeof message === 'object' &&
    message !== null &&
    'jsonrpc' in message &&
    (message as StdioLogNotification).jsonrpc === '2.0' &&
    'method' in message &&
    (message as StdioLogNotification).method === STDIO_LOG_METHOD &&
    'params' in message &&
    typeof (message as StdioLogNotification).params === 'object' &&
    (message as StdioLogNotification).params !== null &&
    'level' in (message as StdioLogNotification).params! &&
    'message' in (message as StdioLogNotification).params!
  );
}

export function createStdioLogNotification(
  params: StdioLogParams,
): StdioLogNotification {
  return {
    jsonrpc: JSONRPC_VERSION,
    method: STDIO_LOG_METHOD,
    params,
  };
}
