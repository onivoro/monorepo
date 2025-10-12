# @onivoro/server-pino

A thin wrapper around `nestjs-pino` for NestJS applications, providing a configuration class and console patching functionality.

## Installation

```bash
npm install @onivoro/server-pino nestjs-pino
```

## Overview

This library provides:
- A configuration class for `nestjs-pino` with sensible defaults
- A console patching function to redirect console methods to Pino logger
- A module that integrates with NestJS

## Usage

### Module Setup

```typescript
import { ServerPinoModule, ServerPinoConfig } from '@onivoro/server-pino';

const config = new ServerPinoConfig({
  excludeUrls: ['/api/health', /^\/api\/metrics/]
});

@Module({
  imports: [
    ServerPinoModule.configure(config)
  ]
})
export class AppModule {}
```

### Configuration Class

The `ServerPinoConfig` class extends `nestjs-pino` Params interface with default settings:

```typescript
const config = new ServerPinoConfig({
  excludeUrls: ['/api/health'],  // URLs to exclude from auto-logging
  useExisting: true,             // Use existing logger instance
  renameContext: 'app'           // Rename context property
});
```

Default configuration includes:
- Auto-generated request IDs using `randomUUID()`
- Redaction of sensitive headers (authorization, cookies, API keys, etc.)
- Info level logging
- Exclusion of specified URLs from auto-logging

### Console Patching

Replace console methods with Pino logger:

```typescript
import { patchConsole } from '@onivoro/server-pino';
import { PinoLogger } from 'nestjs-pino';

const logger = new PinoLogger(config);
const { restore } = patchConsole(logger);

// Now console methods use Pino
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

Constructor options:
- `excludeUrls?: (string | RegExp)[]` - URLs to exclude from auto-logging (default: `['/api/health']`)
- All standard `nestjs-pino` Params options

### ServerPinoModule

```typescript
ServerPinoModule.configure(config: ServerPinoConfig, patchConsoleInstance?: boolean)
```

- `config` - ServerPinoConfig instance
- `patchConsoleInstance` - Whether to patch console methods (default: `false`)

### patchConsole

```typescript
function patchConsole(logger: PinoLogger): {
  _console: PinoLogger;
  restore: () => void;
}
```

## Complete Example

```typescript
import { Module } from '@nestjs/common';
import { ServerPinoModule, ServerPinoConfig } from '@onivoro/server-pino';

const pinoConfig = new ServerPinoConfig({
  excludeUrls: ['/api/health', '/api/metrics'],
  pinoHttp: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: {
        colorize: true
      }
    } : undefined
  }
});

@Module({
  imports: [
    ServerPinoModule.configure(pinoConfig, true) // Enable console patching
  ]
})
export class AppModule {}
```

## Dependencies

This library depends on:
- `nestjs-pino` - The underlying Pino integration for NestJS
- `@nestjs/common` - NestJS common utilities
- `@onivoro/server-common` - For the `moduleFactory` function

## License

MIT