# @onivoro/server-vscode

NestJS-based framework for building VSCode extensions with a three-tier architecture: extension host + stdio server + React webview.

## Installation

```bash
npm install @onivoro/server-vscode
```

## Overview

Each VSCode extension consists of **four Nx projects** that work together:

| Project | Location | Runtime | Build Tool | Purpose |
|---|---|---|---|---|
| `app-browser-my-extension` | `apps/browser/my-extension/` | Browser (webview) | Vite | React UI rendered inside VSCode's webview panel |
| `app-stdio-my-extension` | `apps/stdio/my-extension/` | Node.js (child process) | Webpack | NestJS backend server communicating via stdio JSON-RPC |
| `app-vscode-my-extension` | `apps/vscode/my-extension/` | Node.js (extension host) | Webpack | VSCode extension host — orchestrates server + webview |
| `lib-isomorphic-my-extension` | `libs/isomorphic/my-extension/` | Any | Vite | Shared constants and types across all three tiers |

## Communication Architecture

```
┌─────────────────────────────────────────────────────────┐
│  VSCode Extension Host (apps/vscode/my-extension)       │
│                                                         │
│  ┌───────────────────┐    ┌──────────────────────────┐  │
│  │ CommandHandlers   │    │ WebviewHandlers           │  │
│  │ (palette cmds)    │    │ (webview→extension msgs)  │  │
│  └───────────────────┘    └──────────────────────────┘  │
│                                                         │
│  ┌───────────────────┐    ┌──────────────────────────┐  │
│  │ ServerNotification│    │ WebviewProvider           │  │
│  │ Handlers          │    │ (serves React app)        │  │
│  └───────────────────┘    └──────────────────────────┘  │
│           ▲                         ▲                   │
└───────────┼─────────────────────────┼───────────────────┘
            │ stdio JSON-RPC          │ postMessage
            ▼                         ▼
┌───────────────────────┐  ┌──────────────────────────────┐
│ Stdio Server          │  │ React Webview                │
│ (apps/stdio/          │  │ (apps/browser/               │
│  my-extension)        │  │  my-extension)               │
│                       │  │                              │
│ NestJS + @StdioHandler│  │ Redux + MessageBus middleware│
│ Spawned as child proc │  │ Rendered in webview iframe   │
└───────────────────────┘  └──────────────────────────────┘
```

### Message Routing

1. **Webview → Server** (request/response): Webview dispatches Redux action → `messageBusMiddleware` intercepts → sends via `WebviewMessageBus` → extension receives and checks for a `@WebviewHandler` → if none, forwards to stdio server → server `@StdioHandler` processes and responds → response dispatched back to Redux
2. **Server → Extension** (notifications): Server calls `messageBus.sendNotification()` → extension `@ServerNotificationHandler` receives → can trigger VSCode UI (messages, status bar, etc.)
3. **Extension → Server** (request/response): Command handler calls `messageBus.sendRequest()` → routes to stdio server → `@StdioHandler` processes and responds
4. **Extension → Webview** (notifications): Notifications are automatically broadcast to both extension and webview (with sender exclusion)

---

## Project 1: VSCode Extension (`apps/vscode/my-extension/`)

The orchestrator. It spawns the stdio server, serves the webview, and bridges communication.

### Directory Structure

```
apps/vscode/my-extension/
├── project.json
├── package.json              # VSCode extension manifest (contributes, activationEvents)
├── webpack.config.js
├── tsconfig.json              # extends tsconfig.server.json
├── tsconfig.app.json          # types: ["node", "vscode"]
├── tsconfig.spec.json
└── src/
    ├── main.ts                # Extension entry point
    ├── assets/                # Icons, images
    │   └── icon.svg
    └── app/
        ├── my-extension-extension.module.ts    # NestJS module with @VscodeExtensionModule
        ├── classes/
        │   └── my-extension-webview-provider.class.ts
        └── services/
            ├── my-extension-command-handler.service.ts
            ├── my-extension-webview-handler.service.ts
            └── my-extension-server-notification-handler.service.ts
```

### Entry Point (`src/main.ts`)

```typescript
import 'reflect-metadata';
import { createExtensionFromModule } from '@onivoro/server-vscode';
import { MyExtensionExtensionModule } from './app/my-extension-extension.module';

export const { activate, deactivate } = createExtensionFromModule(
  MyExtensionExtensionModule,
);
```

### Extension Module (`src/app/my-extension-extension.module.ts`)

The `@VscodeExtensionModule` decorator configures the extension. `createExtensionFromModule` reads this configuration to bootstrap everything automatically.

```typescript
import { Module } from '@nestjs/common';
import { VscodeExtensionModule } from '@onivoro/server-vscode';
import { MyExtensionWebviewProvider } from './classes/my-extension-webview-provider.class';
import { MyExtensionCommandHandlerService } from './services/my-extension-command-handler.service';
import { MyExtensionWebviewHandlerService } from './services/my-extension-webview-handler.service';
import { MyExtensionServerNotificationHandlerService } from './services/my-extension-server-notification-handler.service';

@VscodeExtensionModule({
  name: 'MyExtension',                                          // Display name
  serverScript: 'dist/server/main.js',                          // Relative to extensionPath (works for local debug + VSIX)
  webviewViewType: MyExtensionWebviewProvider.viewType,          // Must match package.json views id
  createWebviewProvider: (uri) => new MyExtensionWebviewProvider(uri),
  commandHandlerTokens: [MyExtensionCommandHandlerService],      // Services with @CommandHandler methods
  serverOutputChannel: {
    name: 'MyExtension Server',                                  // OutputChannel for server logs
    showOnError: true,
  },
})
@Module({
  providers: [
    MyExtensionCommandHandlerService,
    MyExtensionWebviewHandlerService,
    MyExtensionServerNotificationHandlerService,
  ],
})
export class MyExtensionExtensionModule {}
```

### Webview Provider (`src/app/classes/my-extension-webview-provider.class.ts`)

Extends `BaseWebviewProvider` to serve the React app from the bundled `dist/webview` directory.

```typescript
import * as vscode from 'vscode';
import {
  BaseWebviewProvider,
  generateVscodeThemeBridgeInjection,
} from '@onivoro/server-vscode';

export class MyExtensionWebviewProvider extends BaseWebviewProvider {
  public static readonly viewType = 'my-extension.webview';      // Must match package.json views id

  constructor(extensionUri: vscode.Uri) {
    super(extensionUri, {
      webviewDistPath: 'dist/webview',          // Relative to extensionPath (works for local debug + VSIX)
      enableCacheBusting: true,
      allowUnsafeInlineStyles: true,
    });
  }

  protected override getInjectedScripts(nonce: string): string {
    return generateVscodeThemeBridgeInjection(nonce);
  }
}
```

### Command Handler Service (`src/app/services/my-extension-command-handler.service.ts`)

Handles VSCode command palette commands. Injects `VSCODE_API`, `MESSAGE_BUS`, and `WEBVIEW_PROVIDER`.

```typescript
import { Injectable, Inject } from '@nestjs/common';
import {
  CommandHandler,
  BaseWebviewProvider,
  WEBVIEW_PROVIDER,
  VSCODE_API,
  VscodeApi,
} from '@onivoro/server-vscode';
import { MESSAGE_BUS, MessageBus } from '@onivoro/isomorphic-jsonrpc';

@Injectable()
export class MyExtensionCommandHandlerService {
  constructor(
    @Inject(VSCODE_API) private readonly vscode: VscodeApi,
    @Inject(MESSAGE_BUS) private readonly messageBus: MessageBus,
    @Inject(WEBVIEW_PROVIDER) private readonly webviewProvider: BaseWebviewProvider,
  ) {}

  @CommandHandler('my-extension.exampleCommand')
  async exampleCommand(): Promise<void> {
    const result = await this.messageBus.sendRequest('example.method', { param: 'value' });
    await this.vscode.window.showInformationMessage(`Result: ${JSON.stringify(result)}`);
  }

  @CommandHandler('my-extension.reloadWebview')
  async reloadWebview(): Promise<void> {
    this.webviewProvider.reload();
    await this.vscode.window.showInformationMessage('Webview reloaded');
  }
}
```

### Webview Handler Service (`src/app/services/my-extension-webview-handler.service.ts`)

Handles messages originating from the React webview. Requests from the webview are routed here first; if no handler matches, they pass through to the stdio server.

```typescript
import { Injectable, Inject } from '@nestjs/common';
import {
  WebviewHandler,
  VscodeWorkspaceService,
  VSCODE_API,
  VscodeApi,
} from '@onivoro/server-vscode';

@Injectable()
export class MyExtensionWebviewHandlerService {
  constructor(
    @Inject(VSCODE_API) private readonly vscode: VscodeApi,
    private readonly workspace: VscodeWorkspaceService,
  ) {}

  @WebviewHandler('showMessage')
  async showMessage(params: { message: string; type?: 'info' | 'warning' | 'error' }): Promise<void> {
    switch (params.type) {
      case 'warning': await this.vscode.window.showWarningMessage(params.message); break;
      case 'error':   await this.vscode.window.showErrorMessage(params.message); break;
      default:        await this.vscode.window.showInformationMessage(params.message);
    }
  }

  @WebviewHandler('showQuickPick')
  async showQuickPick(params: {
    items: Array<{ label: string; description?: string }>;
    title?: string;
    placeholder?: string;
  }): Promise<{ label: string } | null> {
    const result = await this.vscode.window.showQuickPick(params.items, {
      title: params.title,
      placeHolder: params.placeholder,
    });
    return result ? { label: result.label } : null;
  }

  @WebviewHandler('showInputBox')
  async showInputBox(params: {
    prompt?: string; placeholder?: string; value?: string; password?: boolean;
  }): Promise<{ value: string } | null> {
    const result = await this.vscode.window.showInputBox({
      prompt: params.prompt, placeHolder: params.placeholder,
      value: params.value, password: params.password,
    });
    return result !== undefined ? { value: result } : null;
  }

  @WebviewHandler('getWorkspaceFolders')
  getWorkspaceFolders(): { folders: string[] } {
    const folders = this.workspace.workspaceFolders;
    return { folders: folders?.map((f) => f.uri.fsPath) ?? [] };
  }

  @WebviewHandler('getWorkspaceName')
  getWorkspaceName(): { name: string | null } {
    return { name: this.workspace.name ?? null };
  }

  @WebviewHandler('getConfiguration')
  getConfiguration(params: { section: string; key: string }): { value: unknown } {
    const config = this.workspace.getConfiguration(params.section);
    return { value: config.get(params.key) };
  }
}
```

### Server Notification Handler Service (`src/app/services/my-extension-server-notification-handler.service.ts`)

Listens for notifications sent from the stdio server process. Notifications are also automatically broadcast to the webview.

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { ServerNotificationHandler, VSCODE_API, VscodeApi } from '@onivoro/server-vscode';

@Injectable()
export class MyExtensionServerNotificationHandlerService {
  constructor(@Inject(VSCODE_API) private readonly vscode: VscodeApi) {}

  @ServerNotificationHandler('showMessage')
  async handleShowMessage(params: { message: string; type?: 'info' | 'warning' | 'error' }): Promise<void> {
    const { message, type = 'info' } = params;
    switch (type) {
      case 'warning': await this.vscode.window.showWarningMessage(message); break;
      case 'error':   await this.vscode.window.showErrorMessage(message); break;
      default:        await this.vscode.window.showInformationMessage(message);
    }
  }

  @ServerNotificationHandler('taskProgress')
  handleTaskProgress(params: { taskId: string; progress: number; message?: string }): void {
    const { taskId, progress, message } = params;
    const statusMessage = message
      ? `Task ${taskId}: ${progress}% - ${message}`
      : `Task ${taskId}: ${progress}%`;
    this.vscode.window.setStatusBarMessage(statusMessage, 3000);
  }

  @ServerNotificationHandler('customEvent')
  handleCustomEvent(params: { event: string; payload: unknown }): void {
    console.log(`[MyExtension] Custom event: ${params.event}`, params.payload);
  }
}
```

### VSCode Extension Manifest (`package.json`)

This is a standard VSCode extension `package.json`. Key sections:

```json
{
  "name": "my-extension",
  "displayName": "MyExtension",
  "description": "VSCode extension for MyExtension",
  "version": "1.0.0",
  "publisher": "your-publisher-id",
  "engines": { "vscode": "^1.74.0" },
  "categories": ["Other"],
  "activationEvents": ["onStartupFinished"],
  "main": "./dist/main.js",
  "repository": {
    "type": "git",
    "url": "https://github.com/your-org/your-repo"
  },
  "contributes": {
    "commands": [
      { "command": "my-extension.exampleCommand", "title": "MyExtension: Run Example Command" },
      { "command": "my-extension.reloadWebview", "title": "MyExtension: Reload Webview" }
    ],
    "viewsContainers": {
      "activitybar": [
        { "id": "my-extension", "title": "MyExtension", "icon": "resources/icon.svg" }
      ]
    },
    "views": {
      "my-extension": [
        { "type": "webview", "id": "my-extension.webview", "name": "MyExtension", "icon": "resources/icon.svg" }
      ]
    }
  }
}
```

**Critical alignment points:**
- `contributes.views.my-extension[0].id` must equal `MyExtensionWebviewProvider.viewType` and `@VscodeExtensionModule.webviewViewType`
- `contributes.commands[*].command` must match the strings in `@CommandHandler()` decorators
- `main` must point to the webpack output entry
- `repository` field is required or `vsce` will prompt interactively

### Nx Project Configuration (`project.json`)

```json
{
  "name": "app-vscode-my-extension",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "apps/vscode/my-extension/src",
  "projectType": "application",
  "targets": {
    "build": {
      "executor": "@nx/webpack:webpack",
      "dependsOn": ["app-stdio-my-extension:build", "app-browser-my-extension:build"],
      "outputs": ["{options.outputPath}"],
      "defaultConfiguration": "production",
      "options": {
        "target": "node",
        "compiler": "tsc",
        "outputPath": "apps/vscode/my-extension/dist",
        "main": "apps/vscode/my-extension/src/main.ts",
        "tsConfig": "apps/vscode/my-extension/tsconfig.app.json",
        "generatePackageJson": false,
        "assets": [
          { "input": "apps/vscode/my-extension", "glob": "package.json", "output": "." },
          { "input": "apps/vscode/my-extension", "glob": ".vscodeignore", "output": "." },
          { "input": "apps/vscode/my-extension/src/assets", "glob": "**/*", "output": "./resources" },
          { "input": "apps/stdio/my-extension/dist", "glob": "main.js", "output": "./server" },
          { "input": "apps/stdio/my-extension/dist", "glob": "main.js.map", "output": "./server" },
          { "input": "dist/apps/browser/my-extension", "glob": "**/*", "output": "./webview" }
        ],
        "isolatedConfig": true,
        "sourceMap": true,
        "webpackConfig": "apps/vscode/my-extension/webpack.config.js"
      },
      "configurations": {
        "development": {},
        "production": {}
      }
    }
  }
}
```

**Key build dependency:** The vscode project `dependsOn` both the stdio and browser builds. The `assets` array bundles their outputs into the extension:
- `apps/stdio/my-extension/dist/main.js` → `dist/server/main.js` (referenced by `@VscodeExtensionModule.serverScript`)
- `dist/apps/browser/my-extension/**/*` → `dist/webview/**/*` (referenced by `BaseWebviewProvider.webviewDistPath`)

### TypeScript Configuration

```json
// tsconfig.json — extends the server base
{ "extends": "../../../tsconfig.server.json", "files": [], "include": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.spec.json" }] }

// tsconfig.app.json — adds vscode types
{ "extends": "./tsconfig.json",
  "compilerOptions": { "outDir": "../../../dist/out-tsc", "types": ["node", "vscode"] },
  "exclude": ["jest.config.ts", "src/**/*.spec.ts", "src/**/*.test.ts"],
  "include": ["src/**/*.ts"] }
```

### Webpack Configuration

VSCode extensions ship without `node_modules`, so **all dependencies must be bundled** except `vscode` (provided by the runtime). The `withNx()` plugin externalizes all `node_modules` by default for Node targets — this must be overridden. NestJS also pulls in optional microservices transport packages (kafka, grpc, redis, etc.) that must be ignored.

```javascript
const { composePlugins, withNx } = require('@nx/webpack');
const webpack = require('webpack');

module.exports = composePlugins(withNx(), (config) => {
  // Only 'vscode' should remain external (provided by the VS Code runtime).
  config.externals = { vscode: 'commonjs vscode' };

  // Ignore optional NestJS microservices transport dependencies
  config.plugins = config.plugins || [];
  config.plugins.push(
    new webpack.IgnorePlugin({
      checkResource(resource) {
        const optionalDeps = [
          '@grpc/grpc-js',
          '@grpc/proto-loader',
          'kafkajs',
          'mqtt',
          'nats',
          'ioredis',
          'amqplib',
          'amqp-connection-manager',
          'bufferutil',
          'utf-8-validate',
        ];
        return optionalDeps.includes(resource);
      },
    })
  );

  config.ignoreWarnings = [/Failed to parse source map/];

  return config;
});
```

---

## Project 2: Stdio Server (`apps/stdio/my-extension/`)

The backend process. Spawned by the extension as a child process; communicates via stdio using JSON-RPC.

### Directory Structure

```
apps/stdio/my-extension/
├── project.json
├── webpack.config.js
├── tsconfig.json              # extends tsconfig.server.json
├── tsconfig.app.json          # types: ["node", "vscode"]
├── tsconfig.spec.json
└── src/
    ├── main.ts
    └── app/
        ├── app-stdio-my-extension.module.ts
        ├── app-stdio-my-extension-config.class.ts
        └── services/
            └── my-extension-message-handler.service.ts
```

### Entry Point (`src/main.ts`)

```typescript
import { bootstrapStdioApp } from '@onivoro/server-stdio';
import { AppStdioMyExtensionModule } from './app/app-stdio-my-extension.module';

bootstrapStdioApp(AppStdioMyExtensionModule);
```

### NestJS Module (`src/app/app-stdio-my-extension.module.ts`)

```typescript
import { Module } from '@nestjs/common';
import {
  StdioTransportModule,
  StdioTransportService,
  StdioMessageBus,
  createStdioMessageBus,
} from '@onivoro/server-stdio';
import { MESSAGE_BUS } from '@onivoro/isomorphic-jsonrpc';
import { AppStdioMyExtensionConfig } from './app-stdio-my-extension-config.class';
import { MyExtensionMessageHandlerService } from './services/my-extension-message-handler.service';

const config = new AppStdioMyExtensionConfig();

@Module({
  imports: [
    StdioTransportModule.forRoot(),       // Handlers are auto-discovered, not passed here
  ],
  providers: [
    { provide: AppStdioMyExtensionConfig, useValue: config },
    {
      provide: StdioMessageBus,
      useFactory: (transportService: StdioTransportService) =>
        createStdioMessageBus(transportService),
      inject: [StdioTransportService],
    },
    { provide: MESSAGE_BUS, useExisting: StdioMessageBus },
    MyExtensionMessageHandlerService,
  ],
  exports: [StdioMessageBus, MESSAGE_BUS],
})
export class AppStdioMyExtensionModule {}
```

### Message Handler Service (`src/app/services/my-extension-message-handler.service.ts`)

Methods decorated with `@StdioHandler` are auto-discovered by `StdioTransportModule`.

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { StdioHandler } from '@onivoro/server-stdio';
import { MESSAGE_BUS, MessageBus } from '@onivoro/isomorphic-jsonrpc';

@Injectable()
export class MyExtensionMessageHandlerService {
  constructor(@Inject(MESSAGE_BUS) private readonly messageBus: MessageBus) {}

  @StdioHandler('health')
  async health(): Promise<{ status: string; timestamp: string }> {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @StdioHandler('example.method')
  async exampleMethod(params: unknown): Promise<{ success: boolean; params: unknown }> {
    return { success: true, params };
  }

  // Example: long-running task with progress notifications back to extension
  @StdioHandler('demo.longRunningTask')
  async demoLongRunningTask(params: { taskId: string }): Promise<{ success: boolean; taskId: string }> {
    const { taskId } = params;
    for (let progress = 0; progress <= 100; progress += 20) {
      this.messageBus.sendNotification('extension.taskProgress', {
        taskId, progress,
        message: progress < 100 ? 'Processing...' : 'Complete!',
      });
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    this.messageBus.sendNotification('extension.showMessage', {
      message: `Task ${taskId} completed successfully!`,
      type: 'info',
    });
    return { success: true, taskId };
  }
}
```

### Nx Project Configuration (`project.json`)

```json
{
  "name": "app-stdio-my-extension",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "apps/stdio/my-extension/src",
  "projectType": "application",
  "targets": {
    "build": {
      "executor": "@nx/webpack:webpack",
      "outputs": ["{options.outputPath}"],
      "defaultConfiguration": "production",
      "options": {
        "target": "node",
        "compiler": "tsc",
        "outputPath": "apps/stdio/my-extension/dist",
        "main": "apps/stdio/my-extension/src/main.ts",
        "tsConfig": "apps/stdio/my-extension/tsconfig.app.json",
        "generatePackageJson": false,
        "isolatedConfig": true,
        "sourceMap": true,
        "webpackConfig": "apps/stdio/my-extension/webpack.config.js"
      },
      "configurations": { "development": {}, "production": {} }
    }
  }
}
```

### Webpack Configuration

The stdio server runs as a child process of the extension — it also ships without `node_modules`, so all dependencies must be bundled. Unlike the extension, nothing should remain external.

```javascript
const { composePlugins, withNx } = require('@nx/webpack');
const webpack = require('webpack');

module.exports = composePlugins(withNx(), (config) => {
  // Bundle everything — the server runs inside the extension package
  // which has no node_modules.
  config.externals = {};

  // Ignore optional NestJS microservices transport dependencies
  config.plugins = config.plugins || [];
  config.plugins.push(
    new webpack.IgnorePlugin({
      checkResource(resource) {
        const optionalDeps = [
          '@grpc/grpc-js',
          '@grpc/proto-loader',
          'kafkajs',
          'mqtt',
          'nats',
          'ioredis',
          'amqplib',
          'amqp-connection-manager',
          'bufferutil',
          'utf-8-validate',
        ];
        return optionalDeps.includes(resource);
      },
    })
  );

  config.ignoreWarnings = [/Failed to parse source map/];

  return config;
});
```

---

## Project 3: Browser Webview (`apps/browser/my-extension/`)

The React UI rendered inside VSCode's webview panel.

### Directory Structure

```
apps/browser/my-extension/
├── project.json
├── index.html
├── vite.config.ts
├── tsconfig.json              # extends tsconfig.web.json
├── tsconfig.app.json
└── src/
    ├── main.tsx
    └── app/
        ├── app.tsx
        ├── pages/
        │   └── SomePage.tsx
        ├── components/
        │   └── SomeComponent.tsx
        ├── hooks/
        │   └── use-rpc-request.hook.ts
        └── state/
            ├── store.ts
            ├── middleware/
            │   └── message-bus.middleware.ts
            ├── slices/
            │   ├── jsonrpc-request-entity.slice.ts
            │   └── jsonrpc-response-entity.slice.ts
            └── types/
                └── root-state.type.ts
```

### Entry Point (`src/main.tsx`)

```tsx
import { StrictMode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import * as ReactDOM from 'react-dom/client';
import App from './app/app';
import { ThemeProvider, createTheme } from '@mui/material';
import { Provider } from 'react-redux';
import { store } from './app/state/store';

const theme = createTheme();
const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <StrictMode>
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </Provider>
  </StrictMode>,
);
```

### Redux Store (`src/app/state/store.ts`)

```typescript
import { configureStore } from '@reduxjs/toolkit';
import { buildReducers, SliceConfig } from '@onivoro/browser-redux';
import { jsonRpcRequestEntitySlice } from './slices/jsonrpc-request-entity.slice';
import { jsonRpcResponseEntitySlice } from './slices/jsonrpc-response-entity.slice';
import { messageBusMiddleware } from './middleware/message-bus.middleware';

export const sliceRegistry: SliceConfig[] = [
  { slice: jsonRpcRequestEntitySlice },
  { slice: jsonRpcResponseEntitySlice },
];

export const store = configureStore({
  reducer: buildReducers(sliceRegistry),
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(messageBusMiddleware),
});
```

### MessageBus Middleware (`src/app/state/middleware/message-bus.middleware.ts`)

This is the bridge between Redux and the JSON-RPC communication layer. When a request action is dispatched, the middleware sends it to the extension (and potentially on to the server) and dispatches the response back to Redux.

```typescript
import { Middleware, isAction } from '@reduxjs/toolkit';
import { createWebviewMessageBus, WebviewMessageBus } from '@onivoro/browser-jsonrpc';
import { JsonRpcRequest } from '@onivoro/isomorphic-jsonrpc';
import { jsonRpcRequestEntitySlice } from '../slices/jsonrpc-request-entity.slice';
import { jsonRpcResponseEntitySlice } from '../slices/jsonrpc-response-entity.slice';

let messageBusInstance: WebviewMessageBus | null = null;

function getMessageBus(): WebviewMessageBus | null {
  if (messageBusInstance) return messageBusInstance;
  try {
    messageBusInstance = createWebviewMessageBus();
    return messageBusInstance;
  } catch {
    console.warn('[MessageBusMiddleware] VSCode API not available');
    return null;
  }
}

export const messageBusMiddleware: Middleware = (store) => (next) => (action) => {
  const result = next(action);
  if (!isAction(action)) return result;

  const setOneActionType = jsonRpcRequestEntitySlice.actions.setOne.type;
  if (action.type !== setOneActionType) return result;

  const request = (action as ReturnType<typeof jsonRpcRequestEntitySlice.actions.setOne>)
    .payload as JsonRpcRequest & { id: string };

  const messageBus = getMessageBus();
  if (!messageBus) return result;

  messageBus.sendRequest(request.method, request.params)
    .then((responseResult) => {
      store.dispatch(jsonRpcResponseEntitySlice.actions.setOne({
        id: request.id, jsonrpc: '2.0', result: responseResult,
      }));
    })
    .catch((error: Error) => {
      store.dispatch(jsonRpcResponseEntitySlice.actions.setOne({
        id: request.id, jsonrpc: '2.0',
        error: { code: -32603, message: error.message || 'Internal error' },
      }));
    });

  return result;
};

export function disposeMessageBus(): void {
  if (messageBusInstance) { messageBusInstance.dispose(); messageBusInstance = null; }
}
```

### Entity Slices (`src/app/state/slices/`)

```typescript
// jsonrpc-request-entity.slice.ts
import { createEntitySlice } from '@onivoro/browser-redux';
import { JsonRpcRequest } from '@onivoro/isomorphic-jsonrpc';

export const jsonRpcRequestEntitySlice = createEntitySlice<
  Omit<JsonRpcRequest, 'id'> & { id: string }
>('jsonRpcRequestEntitySlice');

// jsonrpc-response-entity.slice.ts
import { createEntitySlice } from '@onivoro/browser-redux';
import { JsonRpcResponse } from '@onivoro/isomorphic-jsonrpc';

export const jsonRpcResponseEntitySlice = createEntitySlice<
  Omit<JsonRpcResponse, 'id'> & { id: string }
>('jsonRpcResponseEntitySlice');
```

### RPC Hook (`src/app/hooks/use-rpc-request.hook.ts`)

Convenience hook for components to send JSON-RPC requests and look up responses.

```typescript
import { useDispatch, useSelector } from 'react-redux';
import { jsonRpcRequestEntitySlice } from '../state/slices/jsonrpc-request-entity.slice';
import { jsonRpcResponseEntitySlice } from '../state/slices/jsonrpc-response-entity.slice';
import { JsonRpcRequest } from '@onivoro/isomorphic-jsonrpc';
import { v4 } from 'uuid';

export function useRpc() {
  const dispatch = useDispatch();
  const responseEntities = useSelector(jsonRpcResponseEntitySlice.selectors.entities);

  function sendRequest<TParams = any>(_: Pick<JsonRpcRequest, 'method'> & { params?: TParams }) {
    const id = v4();
    const { method, params = {} } = _;
    dispatch(jsonRpcRequestEntitySlice.actions.setOne({ id, jsonrpc: '2.0', method, params }));
    return id;
  }

  function lookupResponse(id: string) {
    return responseEntities[id];
  }

  return { sendRequest, lookupResponse };
}
```

### Vite Configuration (`vite.config.ts`)

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/apps/browser/my-extension',
  server: { port: 4200, host: 'localhost' },
  preview: { port: 4300, host: 'localhost' },
  plugins: [react(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  build: {
    outDir: '../../../dist/apps/browser/my-extension',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: { transformMixedEsModules: true },
  },
}));
```

### Nx Project Configuration (`project.json`)

```json
{
  "name": "app-browser-my-extension",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "apps/browser/my-extension/src",
  "projectType": "application",
  "targets": {}
}
```

Targets are inferred by Nx from the `vite.config.ts`.

---

## Project 4: Shared Library (`libs/isomorphic/my-extension/`)

Constants and types shared across all three tiers.

### Directory Structure

```
libs/isomorphic/my-extension/
├── project.json
├── tsconfig.json              # extends tsconfig.isomorphic.json
├── tsconfig.lib.json
├── tsconfig.spec.json
└── src/
    ├── index.ts               # Barrel export
    └── lib/
        ├── constants/
        │   └── my-extension-commands.constant.ts
        └── types/             # Add shared interfaces/types here
```

### Commands Constant (`src/lib/constants/my-extension-commands.constant.ts`)

```typescript
export const myExtensionCommands = {
  SELECT_JSONL_FILE: 'SELECT_JSONL_FILE',
  // Add more shared command identifiers here
};
```

### Barrel Export (`src/index.ts`)

```typescript
export * from './lib/constants/my-extension-commands.constant';
```

### Nx Project Configuration (`project.json`)

```json
{
  "name": "lib-isomorphic-my-extension",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/isomorphic/my-extension/src",
  "projectType": "library",
  "targets": {
    "build": {
      "executor": "@nx/vite:build",
      "generatePackageJson": true,
      "outputs": ["{options.outputPath}"],
      "options": { "outputPath": "dist/libs/isomorphic/my-extension" }
    }
  }
}
```

### TypeScript Configuration

```json
// tsconfig.json
{ "extends": "../../../tsconfig.isomorphic.json", "files": [], "include": [],
  "references": [{ "path": "./tsconfig.lib.json" }, { "path": "./tsconfig.spec.json" }] }

// tsconfig.lib.json
{ "extends": "./tsconfig.json",
  "compilerOptions": { "outDir": "../../../dist/out-tsc" },
  "exclude": ["jest.config.ts", "src/**/*.spec.ts", "src/**/*.test.ts"],
  "include": ["src/**/*.ts"] }
```

---

## Framework Libraries

These `@onivoro/*` libraries provide the foundation. They are not part of the extension itself but are required dependencies:

| Import | Purpose |
|---|---|
| `@onivoro/server-vscode` | `createExtensionFromModule`, `@VscodeExtensionModule`, `@CommandHandler`, `@WebviewHandler`, `@ServerNotificationHandler`, `BaseWebviewProvider`, `VSCODE_API`, `VscodeApi`, `WEBVIEW_PROVIDER`, `VscodeWorkspaceService`, `generateVscodeThemeBridgeInjection` |
| `@onivoro/server-stdio` | `bootstrapStdioApp`, `StdioTransportModule`, `StdioTransportService`, `StdioMessageBus`, `createStdioMessageBus`, `@StdioHandler` |
| `@onivoro/isomorphic-jsonrpc` | `MESSAGE_BUS`, `MessageBus`, `JsonRpcRequest`, `JsonRpcResponse` |
| `@onivoro/browser-jsonrpc` | `createWebviewMessageBus`, `WebviewMessageBus` |
| `@onivoro/browser-redux` | `createEntitySlice`, `buildReducers`, `SliceConfig` |

---

## Building and Installing the VSIX

### Prerequisites

`@vscode/vsce` must be installed as a dev dependency in the monorepo root.

### Package Target

The vscode project's `project.json` includes a `package` target that builds the `.vsix`:

```json
{
  "package": {
    "executor": "nx:run-commands",
    "dependsOn": ["build"],
    "options": {
      "command": "cd apps/vscode/my-extension/dist && node -e \"const p=require('./package.json');p.main='./main.js';require('fs').writeFileSync('./package.json',JSON.stringify(p,null,2))\" && mkdir -p dist && mv server dist/server && mv webview dist/webview && vsce package --no-dependencies --skip-license -o ../my-extension.vsix --baseContentUrl https://github.com/your-org/your-repo --baseImagesUrl https://github.com/your-org/your-repo"
    }
  }
}
```

**What this does:**
1. `dependsOn: ["build"]` ensures the stdio server, browser webview, and extension are all built first
2. Patches `dist/package.json` to fix the `main` entrypoint (the source `package.json` uses `"main": "./dist/main.js"` for development, but inside the `dist/` folder it needs to be `"main": "./main.js"`)
3. Moves `server/` and `webview/` into a `dist/` subdirectory so that paths like `dist/server/main.js` and `dist/webview` resolve correctly from `extensionPath` in both contexts (local debug uses `apps/vscode/my-extension/` as the extension root; the VSIX uses the flat `dist/` content as the root)
4. Runs `vsce package` to produce the `.vsix` file

**Path resolution strategy:** Source code uses `dist/`-prefixed paths (`dist/server/main.js`, `dist/webview`) which resolve correctly during local debug (where `extensionPath` = the project source directory and built files live under `dist/`). The package command restructures the build output so the same `dist/` prefix resolves correctly inside the installed VSIX.

### Build the VSIX

```bash
nx package app-vscode-my-extension
```

This outputs `apps/vscode/my-extension/my-extension.vsix`.

### Install Locally for Testing

```bash
code --install-extension apps/vscode/my-extension/my-extension.vsix
```

Then reload VS Code (`Cmd+Shift+P` → "Developer: Reload Window"). The extension should appear in the activity bar and its commands should be available via the command palette (`Cmd+Shift+P` → "MyExtension:").

---

## Checklist: Creating a New Extension

Replace `my-extension` with your extension's lowercase name and `MyExtension` with the PascalCase version throughout.

1. **Create the shared library** (`libs/isomorphic/my-extension/`)
   - [ ] `project.json` with `lib-isomorphic-my-extension` as the project name
   - [ ] `tsconfig.json` extending `tsconfig.isomorphic.json`
   - [ ] `tsconfig.lib.json`
   - [ ] `src/index.ts` barrel export
   - [ ] `src/lib/constants/my-extension-commands.constant.ts`
   - [ ] Add path mapping to `tsconfig.base.json`

2. **Create the stdio server** (`apps/stdio/my-extension/`)
   - [ ] `project.json` with `app-stdio-my-extension` as the project name
   - [ ] `webpack.config.js`
   - [ ] `tsconfig.json` extending `tsconfig.server.json`
   - [ ] `tsconfig.app.json` with `types: ["node", "vscode"]`
   - [ ] `src/main.ts` — `bootstrapStdioApp()`
   - [ ] `src/app/app-stdio-my-extension.module.ts` — NestJS module with `StdioTransportModule.forRoot()`
   - [ ] `src/app/app-stdio-my-extension-config.class.ts`
   - [ ] `src/app/services/my-extension-message-handler.service.ts` — at minimum a `@StdioHandler('health')` method

3. **Create the browser webview** (`apps/browser/my-extension/`)
   - [ ] `project.json` with `app-browser-my-extension` as the project name
   - [ ] `vite.config.ts` with `outDir: '../../../dist/apps/browser/my-extension'`
   - [ ] `index.html`
   - [ ] `src/main.tsx` — React bootstrap with Redux Provider and MUI ThemeProvider
   - [ ] `src/app/app.tsx`
   - [ ] `src/app/state/store.ts` — configureStore with `messageBusMiddleware`
   - [ ] `src/app/state/middleware/message-bus.middleware.ts`
   - [ ] `src/app/state/slices/jsonrpc-request-entity.slice.ts`
   - [ ] `src/app/state/slices/jsonrpc-response-entity.slice.ts`
   - [ ] `src/app/hooks/use-rpc-request.hook.ts`

4. **Create the VSCode extension** (`apps/vscode/my-extension/`)
   - [ ] `project.json` with `app-vscode-my-extension` as the project name, `dependsOn` stdio + browser builds, and asset bundling
   - [ ] `package.json` — VSCode manifest with commands, viewsContainers, views
   - [ ] `webpack.config.js`
   - [ ] `tsconfig.json` extending `tsconfig.server.json`
   - [ ] `tsconfig.app.json` with `types: ["node", "vscode"]`
   - [ ] `.vscodeignore`
   - [ ] `src/main.ts` — `createExtensionFromModule()`
   - [ ] `src/assets/icon.svg`
   - [ ] `src/app/my-extension-extension.module.ts` — `@VscodeExtensionModule` + `@Module`
   - [ ] `src/app/classes/my-extension-webview-provider.class.ts` — extends `BaseWebviewProvider`
   - [ ] `src/app/services/my-extension-command-handler.service.ts` — `@CommandHandler` methods
   - [ ] `src/app/services/my-extension-webview-handler.service.ts` — `@WebviewHandler` methods
   - [ ] `src/app/services/my-extension-server-notification-handler.service.ts` — `@ServerNotificationHandler` methods

5. **Verify alignment**
   - [ ] `MyExtensionWebviewProvider.viewType` matches `package.json` `contributes.views` id
   - [ ] `@CommandHandler` strings match `package.json` `contributes.commands` entries
   - [ ] `@VscodeExtensionModule.serverScript` points to where stdio `main.js` is bundled
   - [ ] Vite `outDir` for browser matches the extension's asset `input` path for webview

6. **Build and test**
   - [ ] `nx build app-stdio-my-extension`
   - [ ] `nx build app-browser-my-extension`
   - [ ] `nx build app-vscode-my-extension` (should cascade via dependsOn)

## License

MIT
