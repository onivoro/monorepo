# @onivoro/server-process

A lightweight Node.js process management library providing utilities for command execution, Docker container operations, PostgreSQL commands, and reactive process handling.

## Installation

```bash
npm install @onivoro/server-process
```

## Features

- **Promise-based Command Execution**: Simple async/await command execution
- **Reactive Process Streams**: RxJS-based reactive command execution
- **Docker Container Support**: Execute commands within Docker containers
- **PostgreSQL Integration**: Execute psql commands with container support
- **Process I/O Management**: Handle stdin/stdout streams reactively
- **JSON Output Processing**: Parse command output as JSON
- **Line-by-Line Processing**: Stream processing for large outputs

## API Reference

### Command Execution

#### `execPromise(cmd, options?)`

Execute a command and return a promise that resolves to stdout as a string:

```typescript
import { execPromise } from '@onivoro/server-process';

// Simple command execution
const output = await execPromise('ls -la');
console.log(output); // stdout as string

// With options
const result = await execPromise('git status', { cwd: '/path/to/repo' });
```

**Parameters:**
- `cmd: string` - Command to execute
- `options?: EncodingOption & ExecOptions` - Node.js exec options

**Returns:** `Promise<string>` - Command stdout

#### `spawnPromise(program, args?, options?)`

Spawn a process and return a promise that resolves to joined stdout:

```typescript
import { spawnPromise } from '@onivoro/server-process';

// Spawn with arguments
const output = await spawnPromise('node', ['--version']);
console.log(output); // Node.js version

// With spawn options
const result = await spawnPromise('npm', ['install'], { 
  cwd: '/path/to/project',
  env: { ...process.env, NODE_ENV: 'production' }
});
```

**Parameters:**
- `program: string` - Program to spawn
- `args?: string[]` - Command arguments
- `options?: any` - Node.js spawn options

**Returns:** `Promise<string>` - Joined stdout (rejects with stderr on error)

### Reactive Command Execution

#### `execRx(cmd, options?, emitStdErr?)`

Execute a command reactively, emitting stdout (and optionally stderr):

```typescript
import { execRx } from '@onivoro/server-process';

execRx('ping -c 3 google.com').subscribe({
  next: (output) => console.log('Output:', output),
  error: (err) => console.error('Error:', err),
  complete: () => console.log('Command completed')
});

// Without stderr
execRx('ls -la', undefined, false).subscribe(console.log);
```

**Parameters:**
- `cmd: string` - Command to execute
- `options?: EncodingOption & ExecOptions` - Node.js exec options
- `emitStdErr?: boolean` - Include stderr in output (default: true)

**Returns:** `Observable<string>` - Command output stream

#### `execRxAsLines(cmd, options?, emitStdErr?)`

Execute a command and emit output line by line:

```typescript
import { execRxAsLines } from '@onivoro/server-process';

execRxAsLines('cat large-file.txt').subscribe({
  next: (line) => console.log('Line:', line),
  complete: () => console.log('File processed')
});
```

**Parameters:**
- `cmd: string` - Command to execute
- `options?: ExecOptions` - Node.js exec options
- `emitStdErr?: boolean` - Include stderr in output (default: true)

**Returns:** `Observable<string>` - Stream of individual lines

#### `execRxAsJson(cmd, options?, emitStdErr?)`

Execute a command and parse output as JSON:

```typescript
import { execRxAsJson } from '@onivoro/server-process';

execRxAsJson('docker inspect my-container').subscribe({
  next: (json) => console.log('Container info:', json),
  error: (err) => console.error('Failed to parse JSON:', err)
});
```

**Parameters:**
- `cmd: string` - Command to execute
- `options?: ExecOptions` - Node.js exec options
- `emitStdErr?: boolean` - Include stderr in output (default: true)

**Returns:** `Observable<any>` - Stream of parsed JSON objects

### Docker Class

Execute commands within Docker containers:

```typescript
import { Docker } from '@onivoro/server-process';

const docker = new Docker('my-postgres-container', 'psql');

// Execute psql command in container
docker.execRx('-c "SELECT version();"').subscribe({
  next: (result) => console.log('DB Version:', result),
  error: (err) => console.error('Query failed:', err)
});
```

**Constructor:**
- `containerName: string` - Name of the Docker container
- `binaryName: string` - Binary to execute within the container

**Methods:**
- `execRx(cmd, options?, emitStdErr?)` - Execute command reactively within container

### PSql Class

Execute PostgreSQL commands with optional Docker container support:

```typescript
import { PSql } from '@onivoro/server-process';

// Local psql
const psql = new PSql();
psql.execRx('SELECT COUNT(*) FROM users;', 'mydb', 'postgres').subscribe(console.log);

// Container-based psql
const containerPsql = new PSql('postgres-container');
containerPsql.execRx('SELECT NOW();', 'mydb', 'postgres').subscribe(console.log);
```

**Constructor:**
- `containerName?: string` - Optional Docker container name

**Methods:**
- `execRx(cmd, db, username)` - Execute psql command
  - `cmd: string` - SQL command to execute
  - `db: string` - Database name
  - `username: string` - PostgreSQL username

### Process I/O Management

#### `listen()`

Create reactive streams for process stdin/stdout:

```typescript
import { listen } from '@onivoro/server-process';

const { stdout, stdin } = listen();

// Handle stdin data
stdin.subscribe((data) => {
  console.log('Received input:', data.toString());
});

// stdin automatically completes when process.stdin closes
```

**Returns:** `{ stdout: Subject, stdin: Subject }` - Reactive streams for process I/O

#### `exit(code)`

Create a process exit function with specified exit code:

```typescript
import { exit } from '@onivoro/server-process';

const exitWithError = exit(1);
const exitSuccess = exit(0);

// Use in error handling
if (someErrorCondition) {
  console.error('Fatal error occurred');
  exitWithError();
}
```

**Parameters:**
- `code: number` - Exit code

**Returns:** `() => never` - Function that exits the process

## Usage Examples

### Basic Command Execution

```typescript
import { execPromise, spawnPromise } from '@onivoro/server-process';

async function deployApp() {
  try {
    // Check if Docker is running
    await execPromise('docker --version');
    
    // Build and deploy
    const buildOutput = await spawnPromise('docker', ['build', '-t', 'myapp', '.']);
    console.log('Build completed:', buildOutput);
    
    const runOutput = await spawnPromise('docker', ['run', '-d', '-p', '3000:3000', 'myapp']);
    console.log('Container started:', runOutput);
  } catch (error) {
    console.error('Deployment failed:', error);
  }
}
```

### Reactive Log Monitoring

```typescript
import { execRxAsLines } from '@onivoro/server-process';

function monitorLogs(logFile: string) {
  execRxAsLines(`tail -f ${logFile}`)
    .subscribe({
      next: (line) => {
        if (line.includes('ERROR')) {
          console.error('🚨 Error detected:', line);
          // Trigger alert
        } else if (line.includes('WARN')) {
          console.warn('⚠️  Warning:', line);
        }
      },
      error: (err) => console.error('Log monitoring failed:', err)
    });
}

monitorLogs('/var/log/app.log');
```

### Database Operations with Docker

```typescript
import { PSql } from '@onivoro/server-process';

class DatabaseManager {
  private psql = new PSql('postgres-container');

  async checkHealth() {
    return new Promise((resolve, reject) => {
      this.psql.execRx('SELECT 1;', 'postgres', 'admin').subscribe({
        next: (result) => {
          console.log('Database is healthy');
          resolve(result);
        },
        error: reject
      });
    });
  }

  async getUserCount(database: string) {
    return new Promise((resolve, reject) => {
      this.psql.execRx('SELECT COUNT(*) FROM users;', database, 'admin').subscribe({
        next: (result) => resolve(parseInt(result.trim())),
        error: reject
      });
    });
  }
}
```

### JSON Processing

```typescript
import { execRxAsJson } from '@onivoro/server-process';

interface ContainerInfo {
  Id: string;
  Name: string;
  State: { Status: string };
}

function getContainerStatus(containerName: string) {
  execRxAsJson<ContainerInfo[]>(`docker inspect ${containerName}`).subscribe({
    next: (containers) => {
      const container = containers[0];
      console.log(`Container ${container.Name} is ${container.State.Status}`);
    },
    error: (err) => console.error('Failed to get container info:', err)
  });
}
```

### Process I/O Handling

```typescript
import { listen, exit } from '@onivoro/server-process';

function setupInteractiveMode() {
  const { stdin } = listen();
  
  console.log('Enter commands (type "exit" to quit):');
  
  stdin.subscribe({
    next: (data) => {
      const input = data.toString().trim();
      
      if (input === 'exit') {
        console.log('Goodbye!');
        exit(0)();
      } else {
        console.log(`You entered: ${input}`);
      }
    },
    complete: () => {
      console.log('Input stream closed');
      exit(0)();
    }
  });
}
```

## Error Handling

All functions handle errors appropriately:

- **Promise-based functions** reject with error details
- **Reactive functions** emit errors through the error channel
- **Process execution errors** include exit codes and stderr information

```typescript
import { execPromise, execRx } from '@onivoro/server-process';

// Promise error handling
try {
  await execPromise('nonexistent-command');
} catch (error) {
  console.error('Command failed:', error.message);
}

// Reactive error handling
execRx('invalid-command').subscribe({
  next: (output) => console.log(output),
  error: (error) => console.error('Command error:', error),
  complete: () => console.log('Done')
});
```

## TypeScript Support

All functions are fully typed with TypeScript interfaces. The library uses Node.js built-in types for options and return values.

## License

This library is part of the Onivoro monorepo ecosystem.