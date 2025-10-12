# @onivoro/server-cli

Command-line interface utilities for building CLI tools with NestJS and nest-commander.

## Installation

```bash
npm install @onivoro/server-cli
```

## Overview

This library provides a thin abstraction layer over `nest-commander` for building command-line applications with NestJS. It includes an abstract command class, CLI option decorator, and utility functions.

## Core Components

### AbstractCommand

Base class for CLI commands that extends `nest-commander`'s `CommandRunner`:

```typescript
import { AbstractCommand } from '@onivoro/server-cli';
import { Command } from 'nest-commander';

@Command({
  name: 'process',
  description: 'Process data files'
})
export class ProcessCommand extends AbstractCommand {
  async run(inputs: string[], options: Record<string, any>): Promise<void> {
    try {
      console.log('Processing with options:', options);
      // Your command logic here
      
      // The base class handles process.exit() automatically
    } catch (error) {
      // Error will be logged and process will exit with code 1
      throw error;
    }
  }
}
```

The `AbstractCommand` class:
- Automatically handles errors and logs them
- Exits the process with code 0 on success
- Exits the process with code 1 on error
- Extends `CommandRunner` from nest-commander

### CliOption Decorator

Decorator for defining command-line options (re-exported from nest-commander):

```typescript
import { AbstractCommand, CliOption } from '@onivoro/server-cli';
import { Command } from 'nest-commander';

@Command({
  name: 'deploy',
  description: 'Deploy application'
})
export class DeployCommand extends AbstractCommand {
  @CliOption({
    flags: '-e, --environment <environment>',
    description: 'Deployment environment',
    defaultValue: 'development'
  })
  parseEnvironment(val: string): string {
    return val;
  }

  @CliOption({
    flags: '-d, --dry-run',
    description: 'Run without making changes',
    defaultValue: false
  })
  parseDryRun(): boolean {
    return true;
  }

  async run(inputs: string[], options: Record<string, any>): Promise<void> {
    console.log(`Deploying to ${options.environment}`);
    if (options.dryRun) {
      console.log('DRY RUN - No changes will be made');
    }
  }
}
```

### asCommand Function

Utility function to execute async functions as commands with automatic error handling:

```typescript
import { asCommand } from '@onivoro/server-cli';

// Wrap any async function
asCommand(async () => {
  const data = await fetchData();
  await processData(data);
  console.log('Processing complete');
});

// With parameters
const processFile = async (filename: string) => {
  const content = await readFile(filename);
  await process(content);
};

asCommand(() => processFile('data.json'));
```

### Type Definitions

The library exports CLI-related types:

```typescript
import { TCliArgs, TCliCommand, TCliFlag } from '@onivoro/server-cli';

// TCliArgs - Command line arguments type
// TCliCommand - Command configuration type
// TCliFlag - CLI flag definition type
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
  providers: [MigrateCommand]
})
export class AppModule {}

// commands/migrate.command.ts
import { AbstractCommand, CliOption } from '@onivoro/server-cli';
import { Command } from 'nest-commander';
import { Injectable } from '@nestjs/common';

@Injectable()
@Command({
  name: 'migrate',
  description: 'Run database migrations'
})
export class MigrateCommand extends AbstractCommand {
  @CliOption({
    flags: '-d, --direction <direction>',
    description: 'Migration direction (up/down)',
    defaultValue: 'up'
  })
  parseDirection(val: string): string {
    if (!['up', 'down'].includes(val)) {
      throw new Error('Direction must be "up" or "down"');
    }
    return val;
  }

  @CliOption({
    flags: '-c, --count <count>',
    description: 'Number of migrations to run'
  })
  parseCount(val: string): number {
    return parseInt(val, 10);
  }

  async run(inputs: string[], options: Record<string, any>): Promise<void> {
    const { direction, count } = options;
    
    console.log(`Running migrations ${direction}`);
    
    if (count) {
      console.log(`Limited to ${count} migrations`);
    }
    
    // Your migration logic here
    await this.runMigrations(direction, count);
    
    console.log('Migrations complete');
  }

  private async runMigrations(direction: string, count?: number): Promise<void> {
    // Implementation
  }
}
```

## Running Commands

```bash
# Run the command
npx my-cli migrate

# With options
npx my-cli migrate --direction down --count 3

# Get help
npx my-cli migrate --help
```

## Dependencies

This library is built on top of `nest-commander`. Make sure to install it:

```bash
npm install nest-commander
```

## Key Features

- Automatic error handling and process exit
- Built on proven nest-commander library
- Full TypeScript support
- Integrates seamlessly with NestJS dependency injection
- Simple decorator-based option parsing

## Limitations

- This is a thin wrapper over nest-commander
- Limited to nest-commander's features
- No built-in validation beyond what nest-commander provides

## License

MIT