# @onivoro/server-cli

A powerful command-line interface utilities library for Node.js applications, providing abstract command classes, decorators, and type definitions for building robust CLI tools with NestJS.

## Installation

```bash
npm install @onivoro/server-cli
```

## Features

- **Abstract Command Classes**: Base classes for creating structured CLI commands
- **Decorators**: CLI option decorators for parameter parsing
- **Type Definitions**: TypeScript types for CLI operations
- **Command Factory**: Utilities for creating and managing CLI commands
- **Built-in Error Handling**: Automatic error handling and process management

## Quick Start

### Creating a Basic Command

```typescript
import { AbstractCommand, CliOption } from '@onivoro/server-cli';

interface MyCommandParams {
  name: string;
  count: number;
}

export class MyCommand extends AbstractCommand<MyCommandParams> {
  constructor() {
    super('my-command');
  }

  async main(args: string[], params: MyCommandParams): Promise<void> {
    console.log(`Hello ${params.name}! Count: ${params.count}`);
    // Your command logic here
  }
}
```

### Using CLI Options Decorator

```typescript
import { CliOption } from '@onivoro/server-cli';

export class ExampleCommand extends AbstractCommand<{
  verbose: boolean;
  output: string;
}> {
  constructor() {
    super('example');
  }

  @CliOption({
    flags: '-v, --verbose',
    description: 'Enable verbose output'
  })
  verbose: boolean;

  @CliOption({
    flags: '-o, --output <path>',
    description: 'Output file path'
  })
  output: string;

  async main(args: string[], params: any): Promise<void> {
    if (params.verbose) {
      console.log('Verbose mode enabled');
    }
    // Command implementation
  }
}
```

### Command Factory Usage

```typescript
import { asCommand } from '@onivoro/server-cli';

const command = asCommand(MyCommand);
// Use the command in your CLI application
```

## Configuration

The library works seamlessly with NestJS applications and supports:

- **Type Safety**: Full TypeScript support with strongly typed parameters
- **Parameter Validation**: Built-in validation for command parameters
- **Error Handling**: Automatic error catching and process exit handling
- **Flexible Architecture**: Easy to extend and customize for specific needs

## Usage Examples

### Simple Command

```typescript
import { AbstractCommand } from '@onivoro/server-cli';

export class HelloCommand extends AbstractCommand<{ name: string }> {
  constructor() {
    super('hello');
  }

  async main(args: string[], params: { name: string }): Promise<void> {
    console.log(`Hello, ${params.name}!`);
  }
}
```

### Command with Multiple Options

```typescript
import { AbstractCommand, CliOption } from '@onivoro/server-cli';

interface ProcessOptions {
  input: string;
  output: string;
  format: string;
  verbose: boolean;
}

export class ProcessCommand extends AbstractCommand<ProcessOptions> {
  constructor() {
    super('process');
  }

  @CliOption({
    flags: '-i, --input <file>',
    description: 'Input file path',
    required: true
  })
  input: string;

  @CliOption({
    flags: '-o, --output <file>',
    description: 'Output file path',
    required: true
  })
  output: string;

  @CliOption({
    flags: '-f, --format <type>',
    description: 'Output format',
    defaultValue: 'json'
  })
  format: string;

  @CliOption({
    flags: '-v, --verbose',
    description: 'Enable verbose logging'
  })
  verbose: boolean;

  async main(args: string[], params: ProcessOptions): Promise<void> {
    if (params.verbose) {
      console.log(`Processing ${params.input} -> ${params.output} (${params.format})`);
    }
    
    // Processing logic here
    
    console.log('Processing completed successfully');
  }
}
```

### Advanced Command with Validation

```typescript
import { AbstractCommand } from '@onivoro/server-cli';
import { existsSync } from 'fs';

export class ValidatedCommand extends AbstractCommand<{ file: string }> {
  constructor() {
    super('validate');
  }

  async main(args: string[], params: { file: string }): Promise<void> {
    // Custom validation
    if (!existsSync(params.file)) {
      throw new Error(`File not found: ${params.file}`);
    }

    // Command logic
    console.log(`Processing file: ${params.file}`);
  }
}
```

## API Reference

### AbstractCommand<TParams>

Base class for all CLI commands.

- **constructor(name: string)**: Initialize command with a name
- **main(args: string[], params: TParams)**: Abstract method to implement command logic
- **run(args: string[], params: TParams)**: Internal method handling execution and error management

### CliOption Decorator

Decorator for defining CLI options.

```typescript
@CliOption({
  flags: string;        // Command flags (e.g., '-v, --verbose')
  description: string;  // Option description
  required?: boolean;   // Whether option is required
  defaultValue?: any;   // Default value if not provided
})
```

### asCommand Function

Factory function for creating command instances.

```typescript
asCommand<T extends AbstractCommand<any>>(CommandClass: new () => T): T
```

## Error Handling

The library provides built-in error handling:

- Commands automatically catch and log errors
- Process exits with appropriate codes (0 for success, 1 for errors)
- Structured error logging for debugging

## Best Practices

1. **Use Strong Typing**: Always define parameter interfaces for type safety
2. **Validate Input**: Implement validation logic in your `main` method
3. **Handle Errors Gracefully**: Let the base class handle process exits
4. **Use Descriptive Names**: Choose clear, descriptive command names
5. **Document Options**: Provide clear descriptions for all CLI options

## License

This library is part of the Onivoro monorepo ecosystem.