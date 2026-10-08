# @onivoro/server-cli

Command-line interface utilities for building CLI tools with NestJS and nest-commander.

## Installation

```bash
npm install @onivoro/server-cli @nestjs/common nest-commander
```

`@nestjs/common` and `nest-commander` are peer dependencies.

## Overview

This library is a thin layer over `nest-commander`. It provides:

- `AbstractCommand` - a `CommandRunner` base class that exits the process for you
- `CliRequired` / `CliOptional` - property decorators that turn a class member into a `--name [name]` option
- `asCommand` - builds an argv array for invoking a command
- `TCli` - a type mapping a params type's keys to `any`

## Core Components

### AbstractCommand

`AbstractCommand<TParams extends Record<string, string | number>>` extends nest-commander's `CommandRunner`.

- Its constructor takes a `name: string` (stored as the public `name` property), so subclasses call `super('...')`.
- You implement `main(args: string[], params: TParams): Promise<void>` instead of `run`.
- `run` calls `main`, then calls `process.exit(0)` on success. If `main` throws, it logs `{ error }` with `console.error` and calls `process.exit(1)`.

### CliRequired / CliOptional

Decorators that register a nest-commander `@Option` named after the decorated member. The flags are always generated as `--<member> [<member>]`; any `flags` you pass are ignored. `CliRequired` sets `required: true` and `CliOptional` sets `required: false`. Other `OptionMetadata` fields (`description`, `defaultValue`, `choices`, `env`, `name`) are passed through.

If the member is not already a method, the decorator installs an identity parser on the prototype, so a plain property declaration works and the option value arrives as the raw string. If you decorate a method instead, nest-commander uses it as the value parser.

```typescript
import { AbstractCommand, CliOptional, CliRequired } from '@onivoro/server-cli';
import { Command } from 'nest-commander';

type DeployParams = { environment: string; dryRun: string };

@Command({ name: 'deploy', description: 'Deploy application' })
export class DeployCommand extends AbstractCommand<DeployParams> {
  @CliRequired({ description: 'Deployment environment' })
  environment!: string;

  @CliOptional({ description: 'Run without making changes', defaultValue: 'false' })
  dryRun!: string;

  constructor() {
    super('deploy');
  }

  async main(args: string[], { environment, dryRun }: DeployParams): Promise<void> {
    console.log(`Deploying to ${environment}`);
    if (dryRun === 'true') {
      console.log('DRY RUN - no changes will be made');
    }
    // throwing here logs the error and exits with code 1
  }
}
```

```bash
node main.js deploy --environment production --dryRun true
```

### asCommand

`asCommand<TParams>(command: string, params: TParams, file = 'main.js'): string[]`

Builds an argv array (`[file, command, '--key', 'value', ...]`) from a params object. Every value is converted with a template string. Use it to spawn a command or to call `CommandFactory.run` in tests.

```typescript
import { asCommand } from '@onivoro/server-cli';
import { spawn } from 'node:child_process';

asCommand('deploy', { environment: 'production', dryRun: 'true' });
// ['main.js', 'deploy', '--environment', 'production', '--dryRun', 'true']

spawn('node', asCommand('deploy', { environment: 'staging' }, 'dist/main.js'), { stdio: 'inherit' });
```

### TCli

`TCli<TParams>` is `TKeysOf<TParams, any>` from `@onivoro/isomorphic-common`: an object type with the same keys as `TParams` and every value typed as `any`.

```typescript
import { TCli } from '@onivoro/server-cli';

const flags: TCli<{ environment: string; dryRun: string }> = {
  environment: 'production',
  dryRun: true,
};
```

## Complete Example

```typescript
// main.ts
import { CommandFactory } from 'nest-commander';
import { AppModule } from './app.module';

async function bootstrap() {
  await CommandFactory.run(AppModule);
}
bootstrap();

// app.module.ts
import { Module } from '@nestjs/common';
import { MigrateCommand } from './commands/migrate.command';

@Module({
  providers: [MigrateCommand],
})
export class AppModule {}

// commands/migrate.command.ts
import { AbstractCommand, CliOptional, CliRequired } from '@onivoro/server-cli';
import { Command } from 'nest-commander';

type MigrateParams = { direction: string; count: string };

@Command({ name: 'migrate', description: 'Run database migrations' })
export class MigrateCommand extends AbstractCommand<MigrateParams> {
  @CliRequired({ description: 'Migration direction', choices: ['up', 'down'] })
  direction!: string;

  @CliOptional({ description: 'Number of migrations to run' })
  count!: string;

  constructor() {
    super('migrate');
  }

  async main(args: string[], { direction, count }: MigrateParams): Promise<void> {
    const limit = count ? parseInt(count, 10) : undefined;
    console.log(`Running migrations ${direction}${limit ? ` (limit ${limit})` : ''}`);
    // migration logic here
  }
}
```

```bash
node dist/main.js migrate --direction down --count 3
node dist/main.js migrate --help
```

## Dependencies

- Peer: `@nestjs/common`, `nest-commander`
- Direct: `@onivoro/isomorphic-common`, `inquirer`, `safer-buffer`, `tslib`

## License

MIT
