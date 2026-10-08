# @onivoro/isomorphic-jsonrpc

JSON-RPC 2.0 types, utilities, and a `MessageBus` interface for cross-process communication. Contains no transport code and no runtime dependencies besides `tslib`, so it works in both browser and Node.js environments.

## Installation

```bash
npm install @onivoro/isomorphic-jsonrpc
```

## Features

- JSON-RPC 2.0 types (request, response, notification, error) and standard error codes
- `MessageBus` interface for request/response and notification messaging over any transport
- Method routing with target prefixes (`server`, `webview`, `extension`, `broadcast`)
- Disposable utilities for subscription management

`MessageBus` implementations live in other packages: `WebviewMessageBus` in [`@onivoro/browser-jsonrpc`](../../browser/jsonrpc/), `StdioMessageBus` in [`@onivoro/server-stdio`](../../server/stdio/), and `ExtensionMessageBus` in [`@onivoro/server-vscode`](../../server/vscode/).

## JSON-RPC Types

```typescript
const JSONRPC_VERSION = '2.0';

type JsonRpcId = string | number | null;

interface JsonRpcRequest<TParams = unknown> {
  jsonrpc: '2.0';
  method: string;
  params?: TParams;
  id: JsonRpcId;
}

interface JsonRpcNotification<TParams = unknown> {
  jsonrpc: '2.0';
  method: string;
  params?: TParams;
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result?: T;
  error?: JsonRpcError;
}

interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

type JsonRpcHandlerFn<TParams = unknown, TResult = unknown> = (params: TParams) => Promise<TResult>;
```

`isJsonRpcNotification(message: unknown)` is a type guard that returns `true` for an object with `jsonrpc: '2.0'`, a string `method`, and **no** `id` property.

```typescript
import { JSONRPC_VERSION, JsonRpcRequest, isJsonRpcNotification } from '@onivoro/isomorphic-jsonrpc';

const request: JsonRpcRequest<{ id: string }> = {
  jsonrpc: JSONRPC_VERSION,
  method: 'user.get',
  params: { id: '42' },
  id: 1,
};

isJsonRpcNotification(request); // false (has an id)
isJsonRpcNotification({ jsonrpc: '2.0', method: 'user.updated' }); // true
```

## Error Codes

```typescript
const JsonRpcErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SERVER_ERROR_MIN: -32099,
  SERVER_ERROR_MAX: -32000,
} as const;
```

`JsonRpcErrorCode` is the union of these values. `isServerErrorCode(code)` returns `true` for codes from -32099 to -32000 inclusive.

```typescript
import { JsonRpcError, JsonRpcErrorCodes, isServerErrorCode } from '@onivoro/isomorphic-jsonrpc';

const error: JsonRpcError = {
  code: JsonRpcErrorCodes.METHOD_NOT_FOUND,
  message: 'Method not found: user.delete',
};

isServerErrorCode(-32001); // true
isServerErrorCode(error.code); // false
```

## MessageBus

`MessageBus` is an interface only; this package defines the contract that transports implement.

```typescript
interface MessageBus {
  sendRequest<TParams = unknown, TResult = unknown>(
    method: string,
    params?: TParams,
    options?: SendRequestOptions, // { timeoutMs?: number }
  ): Promise<TResult>;

  sendNotification<TParams = unknown>(method: string, params?: TParams): void;

  onNotification<TParams = unknown>(method: string, handler: (params: TParams) => void): Disposable;

  registerHandler<TParams = unknown, TResult = unknown>(
    method: string,
    handler: JsonRpcHandlerFn<TParams, TResult>,
    options?: HandlerRegistrationOptions, // { overwrite?: boolean }
  ): Disposable;

  getRegisteredHandlers(): HandlerInfo[]; // { method: string; canBeOverwritten: boolean }[]
  hasHandler(method: string): boolean;
  dispose(): void;
}
```

The interface documents the intended contract: `sendRequest` rejects if the remote handler returns an error or the request times out; `registerHandler` throws when a handler already exists for the method unless `overwrite: true`; `onNotification` allows several handlers per method; `dispose` removes subscriptions and handlers and rejects pending requests. Implementations are responsible for honoring it.

Related exports:

- `MessageBusFactory<TConfig = unknown>`: `(config?: TConfig) => MessageBus`
- `RequestResult<T>`: `{ success: true; result: T } | { success: false; error: JsonRpcError }`, for APIs that return errors instead of throwing (not used by `MessageBus` itself)
- `NotificationEvent<TParams = unknown>`: `{ method: string; params: TParams; receivedAt: Date }`
- `MESSAGE_BUS`: `Symbol('MESSAGE_BUS')`, an injection token for DI containers such as NestJS

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { MESSAGE_BUS, MessageBus } from '@onivoro/isomorphic-jsonrpc';

@Injectable()
export class HealthService {
  constructor(@Inject(MESSAGE_BUS) private readonly bus: MessageBus) {
    this.bus.registerHandler('health', async () => ({ status: 'ok' }));
  }

  async checkServer() {
    return this.bus.sendRequest<void, { status: string }>('server.health', undefined, { timeoutMs: 5000 });
  }
}
```

## Message Routing

A method can be prefixed with a target and `.` to say where it should be delivered.

```typescript
const MessageTarget = {
  SERVER: 'server', // stdio server process
  WEBVIEW: 'webview', // webview / browser
  EXTENSION: 'extension', // VS Code extension host
  BROADCAST: 'broadcast', // all targets
} as const;
```

`MessageTarget` is also the type of those values. `MESSAGE_TARGETS` lists them, `isMessageTarget(value)` checks a string against them, and `METHOD_TARGET_DELIMITER` is `'.'`.

| Function                                        | Behavior                                                                                                                                                              |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parseMethodTarget(methodString): ParsedMethod` | Splits at the first `.`. If the prefix is a known target, returns `{ target, method: rest, original }`; otherwise `{ target: null, method: methodString, original }`. |
| `createTargetedMethod(target, method)`          | Returns `` `${target}.${method}` ``.                                                                                                                                  |
| `hasTarget(methodString, target)`               | `true` if the parsed target equals `target`.                                                                                                                          |
| `shouldRouteToTarget(methodString, target)`     | `true` if the method is targeted at `target` or at `broadcast`; `false` for untargeted methods.                                                                       |

```typescript
import { MessageTarget, parseMethodTarget, createTargetedMethod, shouldRouteToTarget } from '@onivoro/isomorphic-jsonrpc';

parseMethodTarget('broadcast.user.updated');
// { target: 'broadcast', method: 'user.updated', original: 'broadcast.user.updated' }

parseMethodTarget('user.updated');
// { target: null, method: 'user.updated', original: 'user.updated' }

createTargetedMethod(MessageTarget.SERVER, 'health'); // 'server.health'

shouldRouteToTarget('broadcast.sync', MessageTarget.WEBVIEW); // true
shouldRouteToTarget('server.health', MessageTarget.WEBVIEW); // false
shouldRouteToTarget('health', MessageTarget.SERVER); // false
```

## Disposables

```typescript
type Disposable = () => void;

interface DisposableObject {
  dispose(): void;
}
```

- `toDisposableObject(fn)` wraps a `Disposable` as `{ dispose: fn }` (e.g. for VS Code's `context.subscriptions`).
- `toDisposable(obj)` turns a `DisposableObject` into a `Disposable`.
- `combineDisposables(...fns)` returns one `Disposable` that calls each one in reverse order (LIFO).

```typescript
import { combineDisposables, toDisposableObject } from '@onivoro/isomorphic-jsonrpc';

const cleanup = combineDisposables(
  bus.onNotification('task.progress', (p) => console.log(p)),
  bus.registerHandler('ping', async () => 'pong'),
);

context.subscriptions.push(toDisposableObject(cleanup));
```

## License

This library is licensed under the MIT License. See the LICENSE file in this package for details.
