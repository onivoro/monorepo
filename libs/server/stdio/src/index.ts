// Stdio transport core
export { StdioTransport } from './lib/stdio-transport';

// Stdio log message types (JSON-RPC 2.0 compliant notifications)
export {
  StdioLogNotification,
  StdioLogParams,
  StdioLogLevel,
  STDIO_LOG_METHOD,
  isStdioLogNotification,
  createStdioLogNotification,
} from './lib/stdio-log-message';

// NestJS module and decorators
export { StdioTransportModule } from './lib/stdio-transport-module';
export { StdioTransportModuleConfig } from './lib/stdio-transport-module-config';
export { StdioTransportService } from './lib/stdio-transport-service';

export {
  StdioHandler,
  StdioHandlerMetadata,
  STDIO_HANDLER_METADATA,
} from './lib/stdio-handler';

// Bootstrap
export { bootstrapStdioApp } from './lib/bootstrap-stdio-app';
export { BootstrapStdioAppOptions } from './lib/bootstrap-stdio-app-options';

// Console patching for server process logging via stdio
export {
  patchConsoleForStdio,
  restoreConsole,
  isConsolePatched,
} from './lib/patch-console-for-stdio';

// Request correlation
export { RequestCorrelator } from './lib/request-correlator';

// Stdio server process management (for extension host side)
export {
  StdioServerProcess,
  ServerNotificationHandler,
} from './lib/stdio-server-process';
export { StdioServerProcessConfig } from './lib/stdio-server-process-config';

// MessageBus for stdio server environment
export {
  StdioMessageBus,
  StdioMessageBusConfig,
  createStdioMessageBus,
} from './lib/stdio-message-bus';
