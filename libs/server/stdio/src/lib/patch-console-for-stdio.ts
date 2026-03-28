import { StdioLogLevel, createStdioLogNotification } from './stdio-log-message';

/**
 * Original console methods, saved before patching.
 */
interface OriginalConsoleMethods {
  log: typeof console.log;
  info: typeof console.info;
  warn: typeof console.warn;
  error: typeof console.error;
  debug: typeof console.debug;
  trace: typeof console.trace;
  assert: typeof console.assert;
  count: typeof console.count;
  countReset: typeof console.countReset;
  time: typeof console.time;
  timeEnd: typeof console.timeEnd;
  timeLog: typeof console.timeLog;
  group: typeof console.group;
  groupCollapsed: typeof console.groupCollapsed;
  groupEnd: typeof console.groupEnd;
  table: typeof console.table;
  dir: typeof console.dir;
  dirxml: typeof console.dirxml;
  clear: typeof console.clear;
}

interface PatchState {
  originalMethods: OriginalConsoleMethods;
  counters: Map<string, number>;
  timers: Map<string, number>;
}

const PATCH_SYMBOL = Symbol.for('onivoro-stdio-console-patch');

/**
 * Get the current patch state from globalThis, if any.
 */
function getPatchState(): PatchState | undefined {
  return (globalThis as Record<symbol, PatchState | undefined>)[PATCH_SYMBOL];
}

/**
 * Set the patch state on globalThis.
 */
function setPatchState(state: PatchState | undefined): void {
  (globalThis as Record<symbol, PatchState | undefined>)[PATCH_SYMBOL] = state;
}

/**
 * Format console arguments into a single string.
 */
function formatArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (arg === null) return 'null';
      if (arg === undefined) return 'undefined';
      if (arg instanceof Error) {
        return `${arg.name}: ${arg.message}${arg.stack ? `\n${arg.stack}` : ''}`;
      }
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(' ');
}

/**
 * Send a log notification via stdout.
 */
function sendLogNotification(level: StdioLogLevel, message: string): void {
  const notification = createStdioLogNotification({
    level,
    message,
    timestamp: new Date().toISOString(),
  });
  process.stdout.write(JSON.stringify(notification) + '\n');
}

/**
 * Create a patched console method that sends logs via stdout as JSON-RPC notification.
 * No stderr echo - all logs go through the JSON-RPC protocol only.
 */
function createPatchedMethod(
  level: StdioLogLevel,
): (...args: unknown[]) => void {
  return (...args: unknown[]) => {
    sendLogNotification(level, formatArgs(args));
  };
}

/**
 * Patch console methods to send logs via stdio to the extension.
 *
 * After calling this function:
 * - console.log/info/warn/error/debug will send JSON log messages to stdout
 * - The extension will receive these and route them to an OutputChannel
 * - No stderr output is produced (cleaner child process communication)
 *
 * Uses `Symbol.for('onivoro-stdio-console-patch')` on `globalThis` to ensure
 * only one patch is active even if the module is loaded multiple times.
 *
 * @example
 * ```typescript
 * import { patchConsoleForStdio } from '@onivoro/server-stdio';
 *
 * patchConsoleForStdio();
 *
 * // Now all console.log calls will be sent as JSON-RPC notifications
 * console.log('Server started');
 * // -> { "jsonrpc": "2.0", "method": "log", "params": { "level": "info", "message": "Server started", ... } }
 * ```
 */
export function patchConsoleForStdio(): void {
  if (getPatchState()) {
    process.stderr.write(
      '[onivoro-stdio] Console already patched for stdio; skipping duplicate patch\n',
    );
    return;
  }

  const counters: Map<string, number> = new Map();
  const timers: Map<string, number> = new Map();

  // Save original methods
  const originalMethods: OriginalConsoleMethods = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
    trace: console.trace.bind(console),
    assert: console.assert.bind(console),
    count: console.count.bind(console),
    countReset: console.countReset.bind(console),
    time: console.time.bind(console),
    timeEnd: console.timeEnd.bind(console),
    timeLog: console.timeLog.bind(console),
    group: console.group.bind(console),
    groupCollapsed: console.groupCollapsed.bind(console),
    groupEnd: console.groupEnd.bind(console),
    table: console.table.bind(console),
    dir: console.dir.bind(console),
    dirxml: console.dirxml.bind(console),
    clear: console.clear.bind(console),
  };

  setPatchState({ originalMethods, counters, timers });

  // Patch primary logging methods
  console.log = createPatchedMethod('info');
  console.info = createPatchedMethod('info');
  console.warn = createPatchedMethod('warn');
  console.error = createPatchedMethod('error');
  console.debug = createPatchedMethod('debug');
  console.trace = createPatchedMethod('debug');

  // Patch assertion
  console.assert = (condition?: boolean, ...args: unknown[]) => {
    if (!condition) {
      const message = args.length > 0 ? formatArgs(args) : 'Assertion failed';
      sendLogNotification('error', `Assertion failed: ${message}`);
    }
  };

  // Patch count/countReset
  console.count = (label = 'default') => {
    const count = (counters.get(label) ?? 0) + 1;
    counters.set(label, count);
    sendLogNotification('info', `${label}: ${count}`);
  };

  console.countReset = (label = 'default') => {
    counters.delete(label);
  };

  // Patch timing methods
  console.time = (label = 'default') => {
    timers.set(label, performance.now());
  };

  console.timeEnd = (label = 'default') => {
    const start = timers.get(label);
    if (start !== undefined) {
      const duration = performance.now() - start;
      timers.delete(label);
      sendLogNotification('info', `${label}: ${duration.toFixed(3)}ms`);
    }
  };

  console.timeLog = (label = 'default', ...args: unknown[]) => {
    const start = timers.get(label);
    if (start !== undefined) {
      const duration = performance.now() - start;
      const extra = args.length > 0 ? ` ${formatArgs(args)}` : '';
      sendLogNotification('info', `${label}: ${duration.toFixed(3)}ms${extra}`);
    }
  };

  // Patch grouping methods
  console.group = (...args: unknown[]) => {
    if (args.length > 0) {
      sendLogNotification('info', `▼ ${formatArgs(args)}`);
    }
  };

  console.groupCollapsed = (...args: unknown[]) => {
    if (args.length > 0) {
      sendLogNotification('info', `▶ ${formatArgs(args)}`);
    }
  };

  console.groupEnd = () => {
    // No-op for stdio
  };

  // Patch table/dir
  console.table = (data: unknown) => {
    sendLogNotification('info', formatArgs([data]));
  };

  console.dir = (obj: unknown) => {
    sendLogNotification('info', formatArgs([obj]));
  };

  console.dirxml = (...args: unknown[]) => {
    sendLogNotification('info', formatArgs(args));
  };

  // Patch clear as no-op
  console.clear = () => {
    // No-op for stdio
  };

  // Register cleanup on process exit
  process.on('exit', restoreConsole);
}

/**
 * Restore original console methods.
 */
export function restoreConsole(): void {
  const state = getPatchState();
  if (!state) {
    return;
  }

  const { originalMethods, counters, timers } = state;

  console.log = originalMethods.log;
  console.info = originalMethods.info;
  console.warn = originalMethods.warn;
  console.error = originalMethods.error;
  console.debug = originalMethods.debug;
  console.trace = originalMethods.trace;
  console.assert = originalMethods.assert;
  console.count = originalMethods.count;
  console.countReset = originalMethods.countReset;
  console.time = originalMethods.time;
  console.timeEnd = originalMethods.timeEnd;
  console.timeLog = originalMethods.timeLog;
  console.group = originalMethods.group;
  console.groupCollapsed = originalMethods.groupCollapsed;
  console.groupEnd = originalMethods.groupEnd;
  console.table = originalMethods.table;
  console.dir = originalMethods.dir;
  console.dirxml = originalMethods.dirxml;
  console.clear = originalMethods.clear;

  counters.clear();
  timers.clear();
  setPatchState(undefined);
}

/**
 * Check if console has been patched.
 */
export function isConsolePatched(): boolean {
  return getPatchState() !== undefined;
}
