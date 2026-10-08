# @onivoro/browser-jsonrpc

`WebviewMessageBus`, a browser/webview implementation of the `MessageBus` interface from [`@onivoro/isomorphic-jsonrpc`](../../isomorphic/jsonrpc/). It sends JSON-RPC 2.0 requests and notifications from a VS Code webview to the extension host and receives responses and notifications back.

## Installation

```bash
npm install @onivoro/browser-jsonrpc
```

`@onivoro/isomorphic-jsonrpc` is installed as a dependency.

## How it works

- **Outgoing** messages are sent with `vscodeApi.postMessage(message)`.
- **Incoming** messages are read from a `window` `CustomEvent` (named `'vscode-message'` by default) whose `detail` is the JSON-RPC message. The bus does not listen to `window`'s `message` event itself.

`generateVscodeApiBridgeScript(nonce)` from [`@onivoro/server-vscode`](../../server/vscode/) produces a webview script that sets up both: it exposes `window.vscodeApi` (wrapping `acquireVsCodeApi()`) and re-dispatches every `message` event as a `vscode-message` `CustomEvent`. Without that script, do the equivalent yourself:

```typescript
const vscode = acquireVsCodeApi();
(window as any).vscodeApi = {
  postMessage: (m: unknown) => vscode.postMessage(m),
  getState: () => vscode.getState(),
  setState: (s: unknown) => vscode.setState(s),
};
window.addEventListener('message', (e) => window.dispatchEvent(new CustomEvent('vscode-message', { detail: e.data })));
```

## Usage

```typescript
import { createWebviewMessageBus } from '@onivoro/browser-jsonrpc';

const bus = createWebviewMessageBus({ requestTimeoutMs: 10000 });

// Request / response
const health = await bus.sendRequest<{ verbose: boolean }, { status: string }>('server.health', { verbose: true });

// Fire-and-forget notification
bus.sendNotification('extension.log', { level: 'info', message: 'ready' });

// Listen for notifications pushed by the extension
const unsubscribe = bus.onNotification<{ percent: number }>('task.progress', (params) => {
  console.log(`${params.percent}%`);
});

// Later
unsubscribe();
bus.dispose();
```

## API

### `createWebviewMessageBus(config?: WebviewMessageBusConfig): WebviewMessageBus`

Creates a bus using the global `window.vscodeApi`. Throws `Error('VSCode API not available. This function must be called from within a VSCode webview.')` if it is not defined.

### `createWebviewMessageBusWithApi(vscodeApi: VscodeApiBridge, config?: WebviewMessageBusConfig): WebviewMessageBus`

Creates a bus with an explicit bridge object. Useful for tests or when the API is not on `window`.

```typescript
import { createWebviewMessageBusWithApi, VscodeApiBridge } from '@onivoro/browser-jsonrpc';

const sent: unknown[] = [];
const fakeApi: VscodeApiBridge = {
  postMessage: (m) => sent.push(m),
  getState: () => undefined,
  setState: () => {},
};

const bus = createWebviewMessageBusWithApi(fakeApi, { requestTimeoutMs: 1000 });
```

### `WebviewMessageBus`

`new WebviewMessageBus(vscodeApi: VscodeApiBridge, config?: WebviewMessageBusConfig)`. Implements `MessageBus`; the constructor starts listening on `window` immediately.

| Method                                       | Behavior                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sendRequest(method, params?, options?)`     | Posts `{ jsonrpc: '2.0', id, method, params }` with a generated string id (`webview-<n>-<timestamp>`). Resolves with the response's `result`. Rejects with a `JsonRpcResponseError` (message `error.message`, or `'Unknown error'` if empty, plus the error's `code` and `data`) if the response has an `error`, or with `Error('Request timeout after <ms>ms: <method>')` after `options.timeoutMs` (default: `requestTimeoutMs`). |
| `sendNotification(method, params?)`          | Posts `{ jsonrpc: '2.0', method, params }`.                                                                                                                                                                                                                                                                                                                                                                                         |
| `onNotification(method, handler)`            | Adds a handler for incoming notifications (several per method allowed). Errors thrown by a handler are logged with `console.error`. Returns a `Disposable` that removes it.                                                                                                                                                                                                                                                         |
| `registerHandler(method, handler, options?)` | Stores a handler for incoming requests. Throws `Error('Handler already registered for method: <method>')` if one exists, unless `options.overwrite` is `true`. Returns a `Disposable` that removes it. See incoming requests below.                                                                                                                                                                                                 |
| `getRegisteredHandlers()`                    | `{ method, canBeOverwritten }[]`, where `canBeOverwritten` is the `overwrite` option the handler was registered with.                                                                                                                                                                                                                                                                                                               |
| `hasHandler(method)`                         | Whether a request handler is registered.                                                                                                                                                                                                                                                                                                                                                                                            |
| `dispose()`                                  | Removes the `window` listener, rejects pending requests with `Error('MessageBus disposed')`, and clears all handlers. Idempotent. After disposal, `sendRequest`, `sendNotification`, `onNotification` and `registerHandler` throw `Error('MessageBus has been disposed')`.                                                                                                                                                          |

Incoming messages are dispatched as follows:

- A string `method` and a defined `id` is a **request** (for example `sendRequest('webview.getState')` from the extension). It is passed to the handler added with `registerHandler` for that method, and the bus posts back `{ jsonrpc: '2.0', id, result }` with the handler's return value. With no handler it posts `error: { code: -32601, message: 'Method not found: <method>' }`; if the handler throws it posts `error: { code: -32603, message }`.
- A string `method` and no `id` is a **notification**, passed to the `onNotification` handlers for that method.
- A defined `id` and no `method` is a **response**, matched to a pending request (unknown ids are ignored). A response with neither `result` nor `error` resolves with `undefined`.

Anything else is ignored.

```typescript
import { JsonRpcResponseError } from '@onivoro/browser-jsonrpc';

// Answer requests sent to the webview by the extension
bus.registerHandler('getState', async () => store.getState());

try {
  await bus.sendRequest('server.save', doc);
} catch (error) {
  if (error instanceof JsonRpcResponseError) {
    console.error(error.code, error.message, error.data);
  }
}
```

### `JsonRpcResponseError`

`class JsonRpcResponseError extends Error implements JsonRpcError`: what `sendRequest` rejects with when the response has an `error`. `name` is `'JsonRpcResponseError'`; `code: number` and `data?: unknown` are copied from the response's error. Timeouts and disposal still reject with a plain `Error`.

### `WebviewMessageBusConfig`

```typescript
interface WebviewMessageBusConfig {
  /** Request timeout in milliseconds. Default: 30000 */
  requestTimeoutMs?: number;
  /** Name of the window CustomEvent that carries incoming messages. Default: 'vscode-message' */
  responseEventName?: string;
}
```

### `VscodeApiBridge`

```typescript
interface VscodeApiBridge {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
}
```

## License

This library is licensed under the MIT License. See the LICENSE file in this package for details.
