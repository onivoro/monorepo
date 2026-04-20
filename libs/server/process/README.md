# @onivoro/server-process

A Node.js process execution library providing Promise and RxJS interfaces for running shell commands — locally or inside Docker containers — with true streaming, reactive I/O, abort support, and proper teardown.

## Installation

```bash
npm install @onivoro/server-process
```

## Features

- **Promise-based execution**: `execPromise` and `spawnPromise` for async/await usage
- **Streaming RxJS execution**: `execRx` emits output chunks as they arrive via `spawn`
- **Line-by-line streaming**: `execRxAsLines` with stateful line splitting across chunk boundaries
- **JSON output parsing**: `execRxAsJson` buffers and parses complete JSON output
- **Reactive I/O**: `listen` turns any readable stream (or stdin) into an Observable
- **Docker container support**: Run any command inside a Docker container with `{ container: 'name' }`
- **AbortSignal support**: Cancel running processes with `AbortController`
- **Automatic teardown**: Unsubscribing from an Observable kills the child process

## API Reference

### `execPromise(cmd, options?)`

Promisified `child_process.exec`. Resolves with `{ stdout, stderr }`.

```typescript
import { execPromise } from '@onivoro/server-process';

const { stdout } = await execPromise('ls -la');

// Inside a Docker container
const { stdout: tables } = await execPromise('psql -c "\\dt"', { container: 'my-postgres' });

// With options
const { stdout: status } = await execPromise('git status', { cwd: '/path/to/repo', timeout: 5000 });
```

**Parameters:**
- `cmd: string` - Shell command to execute
- `options?: ExecPromiseOptions` - Node.js `ExecOptions` plus:
  - `container?: string` - Docker container name (runs via `docker exec`)

**Returns:** `Promise<{ stdout: string; stderr: string }>`

### `spawnPromise(program, args?, options?)`

Spawn a process and return a promise that resolves to collected stdout.

```typescript
import { spawnPromise } from '@onivoro/server-process';

const version = await spawnPromise('node', ['--version']);

// Inside a Docker container
const result = await spawnPromise('psql', ['-c', 'SELECT 1'], { container: 'my-postgres' });

// With abort support
const ac = new AbortController();
const output = await spawnPromise('npm', ['install'], { signal: ac.signal });
```

**Parameters:**
- `program: string` - Program to spawn
- `args?: string[]` - Command arguments
- `options?: SpawnPromiseOptions` - Node.js `SpawnOptions` plus:
  - `container?: string` - Docker container name (runs via `docker exec`)

**Returns:** `Promise<string>` - Collected stdout (rejects with `Error` containing stderr on non-zero exit)

### `execRx(cmd, options?)`

Execute a command reactively with true streaming. Each `data` chunk from the child process is emitted as it arrives.

```typescript
import { execRx } from '@onivoro/server-process';

// Stream output as it arrives
execRx('tail -f /var/log/app.log').subscribe({
  next: (chunk) => console.log(chunk),
  error: (err) => console.error(err),
  complete: () => console.log('Done')
});

// Unsubscribing kills the child process
const sub = execRx('long-running-command').subscribe(console.log);
sub.unsubscribe(); // process is killed

// Inside a Docker container — same API, just add container
execRx('cat /var/log/app.log', { container: 'my-app' }).subscribe(console.log);

// With AbortSignal — completes cleanly, does not error
const ac = new AbortController();
execRx('sleep 60', { signal: ac.signal }).subscribe({
  complete: () => console.log('Cancelled')
});
ac.abort();
```

**Parameters:**
- `cmd: string` - Shell command to execute
- `options?: ExecRxOptions` - Options object:
  - `emitStdErr?: boolean` - Include stderr chunks in output (default: `true`)
  - `container?: string` - Docker container name (runs via `docker exec`)
  - Plus all Node.js `SpawnOptions` (`cwd`, `env`, `signal`, etc.)

**Returns:** `Observable<string>` - Stream of output chunks

### `execRxAsLines(cmd, options?)`

Execute a command and emit output line by line. Uses stateful buffering to correctly handle lines that span chunk boundaries.

```typescript
import { execRxAsLines } from '@onivoro/server-process';

execRxAsLines('cat large-file.txt').subscribe({
  next: (line) => console.log('Line:', line),
  complete: () => console.log('Done')
});
```

**Parameters:** Same as `execRx`

**Returns:** `Observable<string>` - Stream of individual lines (empty lines are filtered out)

### `execRxAsJson<T>(cmd, options?)`

Execute a command, buffer all output, and parse as JSON. The output is fully collected before parsing since JSON documents cannot be parsed incrementally from arbitrary chunk boundaries.

```typescript
import { execRxAsJson } from '@onivoro/server-process';

interface ContainerInfo {
  Id: string;
  Name: string;
  State: { Status: string };
}

execRxAsJson<ContainerInfo[]>('docker inspect my-container').subscribe({
  next: (containers) => console.log(containers[0].State.Status),
  error: (err) => console.error('Failed:', err)
});
```

**Parameters:** Same as `execRx`

**Returns:** `Observable<T>` - Single emission of parsed JSON

### `listen(options?)`

Create an RxJS Observable from a readable stream (defaults to `process.stdin`). By default, emits individual lines with stateful buffering across chunk boundaries. Use `{ lines: false }` for raw chunks.

```typescript
import { listen } from '@onivoro/server-process';

// Line-by-line from stdin (default)
listen().subscribe((line) => {
  console.log('Got:', line);
});

// Raw chunks
listen({ lines: false }).subscribe((chunk) => {
  process.stdout.write(chunk.toUpperCase());
});
```

```typescript
// From any readable stream
import { listen } from '@onivoro/server-process';
import { createReadStream } from 'fs';

listen({ input: createReadStream('/var/log/app.log') }).subscribe(console.log);
```

**Parameters:**
- `options?: ListenOptions` - Options object:
  - `lines?: boolean` - Split into lines (default: `true`)
  - `input?: NodeJS.ReadableStream` - Stream to read from (default: `process.stdin`)

**Returns:** `Observable<string>` - Stream of lines or raw chunks. Completes when the input stream ends. Unsubscribing removes all listeners.

### `splitLines(source$)`

RxJS operator that splits a stream of string chunks into individual lines. Buffers incomplete lines across chunk boundaries and emits the final fragment on completion.

```typescript
import { splitLines, execRx } from '@onivoro/server-process';

splitLines(execRx('some-command')).subscribe(console.log);
```

**Parameters:**
- `source$: Observable<string>` - Source observable of string chunks

**Returns:** `Observable<string>` - Stream of individual lines (empty lines filtered out)

### `exit(code)`

Create a bound process exit function.

```typescript
import { exit } from '@onivoro/server-process';

const exitWithError = exit(1);
const exitSuccess = exit(0);

if (fatalError) {
  exitWithError();
}
```

**Parameters:**
- `code: number` - Exit code

**Returns:** `() => never`

## Error Handling

- **Promise functions** reject with the error from `exec`/`spawn`
- **Reactive functions** emit errors through the Observable error channel
- **Non-zero exit codes** produce an `Error` with the exit code in the message
- **AbortSignal** in reactive functions (`execRx`, `execRxAsLines`, `execRxAsJson`) completes cleanly — cancellation is not an error. In Promise functions (`execPromise`, `spawnPromise`), abort rejects the promise

```typescript
import { execPromise, execRx } from '@onivoro/server-process';

// Promise
try {
  await execPromise('nonexistent-command');
} catch (error) {
  console.error('Failed:', error.message);
}

// Reactive
execRx('invalid-command').subscribe({
  error: (error) => console.error('Failed:', error.message)
});
```

## License

MIT
