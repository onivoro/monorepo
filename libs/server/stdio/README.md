# @onivoro/server-stdio

Stdio-based JSON-RPC 2.0 transport layer for NestJS applications. Provides child process communication, console patching, and message bus for VSCode extension server processes.

There are two sides:

- **Server process** (a NestJS app running as a child process): `StdioTransportModule`, `@StdioHandler`, `bootstrapStdioApp`, `patchConsoleForStdio`, `StdioMessageBus`. It reads newline-delimited JSON-RPC requests from stdin and writes responses, notifications and log messages to stdout.
- **Host process** (e.g. a VSCode extension): `StdioServerProcess` spawns the server with `node`, sends requests, and receives responses, notifications and logs.

## Installation

```bash
npm install @onivoro/server-stdio
```

Peer dependencies: `@nestjs/common`, `@nestjs/core`, `reflect-metadata`, `rxjs`. JSON-RPC types (`JsonRpcRequest`, `MessageBus`, `MESSAGE_BUS`, ...) come from [`@onivoro/isomorphic-jsonrpc`](../../isomorphic/jsonrpc/), which is installed as a dependency.

## Server process

### Handlers and module

Decorate methods on an `@Injectable()` class with `@StdioHandler(method)`. Each handler receives the request's `params` and its return value (or resolved promise) becomes the JSON-RPC `result`. A thrown error becomes an `INTERNAL_ERROR` response with the error's message and stack.

```typescript
import { Injectable, Module } from '@nestjs/common';
import { StdioHandler, StdioTransportModule } from '@onivoro/server-stdio';

@Injectable()
export class HealthHandlers {
  @StdioHandler('health')
  async health() {
    return { status: 'ok', uptime: process.uptime() };
  }

  @StdioHandler('user.get')
  async getUser(params: { id: string }) {
    return { id: params.id, name: 'Ada' };
  }
}

@Module({
  imports: [StdioTransportModule.forRoot({ handlers: [HealthHandlers] })],
})
export class AppModule {}
```

`StdioTransportModule.forRoot(config?: StdioTransportModuleConfig)` returns a **global** dynamic module that provides `StdioTransportService` (exported) plus every class in `handlers`. On module init, `StdioTransportService` scans _all_ providers in the application (not only those in `handlers`) for `@StdioHandler` methods and registers them. Registering the same method name twice throws.

### bootstrapStdioApp

```typescript
import { bootstrapStdioApp } from '@onivoro/server-stdio';
import { AppModule } from './app.module';

bootstrapStdioApp(AppModule, {
  onReady: async (app) => {
    console.log('ready');
  },
});
```

`bootstrapStdioApp(module, options?: BootstrapStdioAppOptions): Promise<void>`:

1. Calls `patchConsoleForStdio()`.
2. Creates a Nest application context (`NestFactory.createApplicationContext`, no HTTP server) with buffered logs, applies `options.logger` (default `console`; pass `false` to disable Nest logging), and calls `app.init()`.
3. Logs the number of registered handlers, or warns if `StdioTransportService` is missing.
4. Awaits `options.onReady(app)` if given.
5. Installs `SIGINT`/`SIGTERM` handlers that close the app and `process.exit(0)`.

### StdioTransportService

Injectable anywhere once `StdioTransportModule.forRoot()` is imported.

| Member                                                                 | Description                                                            |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `getTransport(): StdioTransport`                                       | The underlying transport                                               |
| `registerHandler(method, handler: (params) => Promise<TResult>): void` | Register a handler manually (throws if `method` is already registered) |
| `sendNotification(method, params?): void`                              | Write a JSON-RPC notification (no `id`) to stdout                      |

```typescript
@Injectable()
export class FileWatcher {
  constructor(private readonly stdio: StdioTransportService) {}

  onChange(path: string) {
    this.stdio.sendNotification('file.changed', { path });
  }
}
```

### StdioTransport

The low-level transport, created by `StdioTransportService`. Its constructor attaches a `readline` interface to `process.stdin`, so normally you don't construct one yourself.

- `on(method, handler)` — register a `JsonRpcHandlerFn`; throws if `method` already has a handler
- `removeHandler(method)`, `hasHandler(method)`, `getRegisteredMethods()`
- `onNotification(listener: (method, params) => void)` — called for each incoming notification (a message with a `method` but no `id`); returns a function that removes the listener
- `close()` — closes the readline interface

Responses to incoming lines:

- Blank lines are ignored.
- Lines that are not valid JSON get a `PARSE_ERROR` response with `id: null`.
- Messages without a `method` get an `INVALID_REQUEST` response with the message's `id` (`null` if the id is missing or not a string or number).
- Notifications (no `id`) get no response; they are passed to `onNotification` listeners, not to `on` handlers.
- Unknown methods get a `METHOD_NOT_FOUND` error response.

### StdioMessageBus

An implementation of the `MessageBus` interface from `@onivoro/isomorphic-jsonrpc` on top of `StdioTransportService`.

- `registerHandler(method, handler, options?)` — registers on the transport; throws if a handler exists unless `options.overwrite` is `true`. Returns a `Disposable` (a function) that unregisters it.
- `sendNotification(method, params?)` — delegates to `StdioTransportService.sendNotification`.
- `sendRequest()` — always throws; the server cannot initiate requests.
- `onNotification(method, handler)` — calls `handler(params)` for each incoming notification for `method` from the extension. Multiple handlers per method are allowed; one that throws is logged with `console.error` and does not stop the others. Returns a `Disposable` that unsubscribes it.
- `getRegisteredHandlers(): HandlerInfo[]`, `hasHandler(method)`
- `dispose()` (also called from `onModuleDestroy`) — removes its notification subscriptions, unregisters the handlers it registered from the transport (handlers registered on the transport by other means are kept), and makes later `registerHandler`, `onNotification` and `sendNotification` calls throw.

`StdioMessageBus` is not provided by `StdioTransportModule`. Its constructor takes an optional `StdioMessageBusConfig` (`{ requestTimeoutMs?: number }`, default `30000`, currently unused), so provide it with the `createStdioMessageBus` factory:

```typescript
import { Module } from '@nestjs/common';
import { MESSAGE_BUS } from '@onivoro/isomorphic-jsonrpc';
import { StdioMessageBus, StdioTransportModule, StdioTransportService, createStdioMessageBus } from '@onivoro/server-stdio';

@Module({
  imports: [StdioTransportModule.forRoot()],
  providers: [
    {
      provide: StdioMessageBus,
      useFactory: (transport: StdioTransportService) => createStdioMessageBus(transport),
      inject: [StdioTransportService],
    },
    { provide: MESSAGE_BUS, useExisting: StdioMessageBus },
  ],
})
export class AppModule {}
```

### Console patching

stdout is the protocol channel, so plain `console.log` output would corrupt it. `patchConsoleForStdio()` replaces the `console` methods so each call writes a log notification to stdout instead:

```json
{ "jsonrpc": "2.0", "method": "log", "params": { "level": "info", "message": "Server started", "timestamp": "2026-01-01T00:00:00.000Z" } }
```

- `log`/`info` → `info`, `warn` → `warn`, `error` → `error`, `debug`/`trace` → `debug`
- `assert`, `count`, `time`/`timeEnd`/`timeLog`, `group`/`groupCollapsed`, `table`, `dir`, `dirxml` are emulated; `countReset` and `groupEnd`/`clear` are handled silently
- Nothing is written to stderr. Patch state is stored on `globalThis` under `Symbol.for('onivoro-stdio-console-patch')`, so a second call is a no-op (it writes a one-line notice to stderr).
- `restoreConsole()` restores the originals (also registered on `process.on('exit')`); `isConsolePatched()` reports the current state.

### Log message helpers

```typescript
import {
  STDIO_LOG_METHOD, // 'log'
  StdioLogLevel, // 'debug' | 'info' | 'warn' | 'error'
  StdioLogParams, // { level, message, timestamp }
  StdioLogNotification,
  createStdioLogNotification,
  isStdioLogNotification,
} from '@onivoro/server-stdio';

const note = createStdioLogNotification({
  level: 'warn',
  message: 'disk almost full',
  timestamp: new Date().toISOString(),
});
isStdioLogNotification(note); // true
```

### Decorator metadata

`STDIO_HANDLER_METADATA` is the metadata key `@StdioHandler` sets, with a value of type `StdioHandlerMetadata` (`{ method: string }`).

## Host process

### StdioServerProcess

```typescript
import { StdioServerProcess } from '@onivoro/server-stdio';

const server = new StdioServerProcess({
  requestTimeoutMs: 10_000,
  onLog: ({ level, message }) => output.appendLine(`[${level}] ${message}`),
  onStderr: (data) => output.appendLine(data),
  onExit: (code) => output.appendLine(`server exited: ${code}`),
  onError: (err) => output.appendLine(err.message),
});

server.start(context.extensionPath, 'dist/server/main.js', ['--enable-source-maps']);

const unsubscribe = server.onNotification<{ path: string }>('file.changed', ({ path }) => {
  console.log('changed', path);
});

const health = await server.sendRequest<{ status: string }>('health');

unsubscribe();
server.stop();
```

`StdioServerProcessConfig` (all optional): `requestTimeoutMs` (default `30000`), `onStderr(data)`, `onExit(code)`, `onError(error)`, `onLog(log: StdioLogParams)`.

| Member                                                             | Description                                                                                                  |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `start(extensionPath, serverScript, nodeArgs = [])`                | Spawns `node ...nodeArgs <path.resolve(extensionPath, serverScript)>`; throws if already running             |
| `stop()`                                                           | Rejects pending requests and kills the process                                                               |
| `isRunning`                                                        | `true` while a process is attached                                                                           |
| `sendRequest<T>(method, params?, timeoutMs?)`                      | Sends a request; rejects on error response, timeout, or process exit                                         |
| `onNotification<T>(method, handler: ServerNotificationHandler<T>)` | Subscribe to server notifications; returns an unsubscribe function. Multiple handlers per method are allowed |
| `offNotification(method)`                                          | Remove all handlers for a method                                                                             |
| `getRegisteredNotifications()`                                     | Methods that have handlers                                                                                   |

Messages with `method: 'log'` go to `onLog` rather than to notification handlers.

### RequestCorrelator

Generic helper `StdioServerProcess` uses to match responses to requests. IDs are incrementing numeric strings (`'1'`, `'2'`, ...).

```typescript
import { RequestCorrelator } from '@onivoro/server-stdio';

const correlator = new RequestCorrelator<string>(5000); // default timeout, 30000 if omitted; 0 disables

const { id, promise } = correlator.createRequest(); // or createRequest(customTimeoutMs)
send({ id, method: 'ping' });

// when the reply arrives:
correlator.resolve(id, 'pong'); // or correlator.reject(id, new Error('failed'))

await promise; // 'pong'
```

Also: `hasPending(id)`, `pendingCount`, `cancelAll(error?)`. `resolve`/`reject` return `false` if the id is unknown.

## License

MIT
