# @onivoro/server-pino

A thin wrapper around `nestjs-pino` for NestJS applications, providing a configuration class and console patching functionality.

## Installation

```bash
npm install @onivoro/server-pino nestjs-pino pino-http
```

`@nestjs/common`, `nestjs-pino` and `pino-http` are peer dependencies.

## Overview

This library provides:

- A configuration class for `nestjs-pino` with sensible defaults
- A console patching function to redirect console methods to Pino logger
- A module that integrates with NestJS

## Usage

### Module Setup

```typescript
import { Module } from '@nestjs/common';
import { ServerPinoModule, ServerPinoConfig } from '@onivoro/server-pino';

const config = new ServerPinoConfig({
  excludeUrls: ['/api/health', /^\/api\/metrics/],
});

@Module({
  imports: [ServerPinoModule.configure(config)],
})
export class AppModule {}
```

### Configuration Class

The `ServerPinoConfig` class implements the `nestjs-pino` `Params` interface and fills in a default `pinoHttp`:

```typescript
const config = new ServerPinoConfig({
  excludeUrls: ['/api/health'], // URLs to exclude from request auto-logging
  renameContext: 'module', // nestjs-pino: key used for the logger context
});
```

The default `pinoHttp` (from `ServerPinoConfig.getDefaultParams(excludeUrls)`) sets:

- `genReqId` - a `randomUUID()` per request
- `autoLogging.ignore` - skips requests matching `excludeUrls`. A string must equal `req.url` exactly (query string included); a `RegExp` is tested against `req.url`. An empty array ignores nothing.
- `redact` - request headers `accept`, `accept-encoding`, `accept-language`, `authorization`, `x-api-id`, `x-api-key`, `cache-control`, `connection`, `cookie`, `sec-ch-ua`, `sec-ch-ua-mobile`, `sec-ch-ua-platform`, `sec-fetch-dest`, `sec-fetch-mode`, `sec-fetch-site`, `sec-fetch-user`, `upgrade-insecure-requests`, `user-agent`, and the response `set-cookie` header
- `useLevel: 'info'` - the level pino-http uses for its request/response log lines
- `transport: undefined`

Overrides are merged shallowly over these defaults. Passing your own `pinoHttp` replaces the whole default object, so the redaction, request IDs and URL exclusion are lost unless you spread them back in (see the [Complete Example](#complete-example)).

### Console Patching

Replace console methods with Pino logger:

```typescript
import { patchConsole } from '@onivoro/server-pino';
import { PinoLogger } from 'nestjs-pino';

const logger = new PinoLogger(config);
const { restore } = patchConsole(logger);

// Now console methods use Pino. Arguments are logged as an array under `msg`:
// console.log('a', 1) -> logger.info({ msg: ['a', 1] })
console.log('This goes to Pino');
console.error('This is an error');

// Restore original console if needed
restore();
```

Patched methods:

- `console.debug` → `logger.debug`
- `console.error` → `logger.error`
- `console.info` → `logger.info`
- `console.log` → `logger.info`
- `console.trace` → `logger.trace`
- `console.warn` → `logger.warn`

## API Reference

### ServerPinoConfig

```typescript
new ServerPinoConfig(overrides?: Partial<Params> & { excludeUrls?: (string | RegExp)[] })
```

- `excludeUrls` - URLs to exclude from auto-logging (default: `['/api/health']`)
- Any `nestjs-pino` `Params` option (`pinoHttp`, `exclude`, `forRoutes`, `renameContext`, `useExisting`), assigned over the defaults

`ServerPinoConfig.getDefaultParams(excludeUrls = ['/api/health']): Params` returns the default params described above.

The header names used in the redaction list are exported as constants:

```typescript
import { apiIdHeader, apiKeyHeader } from '@onivoro/server-pino';
// apiIdHeader === 'x-api-id', apiKeyHeader === 'x-api-key'
```

### ServerPinoModule

```typescript
ServerPinoModule.configure(config: ServerPinoConfig, patchConsoleInstance?: boolean)
```

- `config` - ServerPinoConfig instance, passed to `LoggerModule.forRoot` and provided as `ServerPinoConfig`
- `patchConsoleInstance` - Whether to patch console methods (default: `false`). When `true`, `patchConsole(new PinoLogger(config))` runs immediately inside `configure`, and there is no handle to restore the original console.

### patchConsole

```typescript
function patchConsole(logger: PinoLogger): {
  _console: PinoLogger;
  restore: () => void;
};
```

## Complete Example

```typescript
import { Module } from '@nestjs/common';
import { ServerPinoModule, ServerPinoConfig } from '@onivoro/server-pino';

const excludeUrls = ['/api/health', '/api/metrics'];
const defaults = ServerPinoConfig.getDefaultParams(excludeUrls).pinoHttp as object;

const pinoConfig = new ServerPinoConfig({
  excludeUrls,
  pinoHttp: {
    ...defaults, // keep redaction, request IDs and URL exclusion
    level: process.env.LOG_LEVEL || 'info',
    transport:
      process.env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
            },
          }
        : undefined,
  },
});

@Module({
  imports: [
    ServerPinoModule.configure(pinoConfig, true), // Enable console patching
  ],
})
export class AppModule {}
```

## Dependencies

This library depends on:

- `nestjs-pino` - The underlying Pino integration for NestJS
- `@nestjs/common` - NestJS common utilities
- `pino-http` - peer dependency used for the `pinoHttp` option types
- `@onivoro/server-common` - For the `moduleFactory` function

## License

MIT
