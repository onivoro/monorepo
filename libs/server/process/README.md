# @onivoro/server-process

A comprehensive process management library for Node.js applications, providing utilities for executing commands, managing Docker containers, PostgreSQL operations, and handling system processes with reactive programming support.

## Installation

```bash
npm install @onivoro/server-process
```

## Features

- **Command Execution**: Promise-based and reactive command execution
- **Docker Integration**: Docker container management utilities
- **PostgreSQL Tools**: PSql command execution and database operations
- **Process Management**: Spawn and manage child processes
- **Reactive Streams**: RxJS-based reactive process handling
- **JSON Processing**: Parse command output as JSON
- **Line-by-Line Processing**: Stream processing for large outputs
- **Error Handling**: Comprehensive error handling for process operations
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Quick Start

### Basic Command Execution

```typescript
import { execPromise, shell } from '@onivoro/server-process';

// Simple command execution
const result = await execPromise('ls -la');
console.log(result.stdout);

// Alternative using shell function (if available in common)
const output = await shell('pwd');
console.log(output);
```

### Docker Operations

```typescript
import { Docker } from '@onivoro/server-process';

const docker = new Docker();

// List running containers
const containers = await docker.listContainers();

// Run a container
await docker.run('nginx:latest', {
  ports: ['80:80'],
  detach: true,
  name: 'my-nginx'
});

// Execute command in container
const result = await docker.exec('my-nginx', 'ls /usr/share/nginx/html');
```

### PostgreSQL Operations

```typescript
import { PSql } from '@onivoro/server-process';

const psql = new PSql({
  host: 'localhost',
  port: 5432,
  database: 'mydb',
  username: 'user',
  password: 'password'
});

// Execute SQL query
const users = await psql.query('SELECT * FROM users');

// Execute SQL file
await psql.executeFile('./migrations/001_create_tables.sql');
```

## Usage Examples

### Reactive Command Execution

```typescript
import { execRx, execRxAsLines, execRxAsJson } from '@onivoro/server-process';
import { tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

// Execute command reactively
execRx('ping google.com')
  .pipe(
    tap(data => console.log('Output:', data)),
    catchError(error => {
      console.error('Command failed:', error);
      return of(null);
    })
  )
  .subscribe();

// Process output line by line
execRxAsLines('tail -f /var/log/system.log')
  .pipe(
    tap(line => console.log('Log line:', line))
  )
  .subscribe();

// Parse JSON output
execRxAsJson('docker inspect my-container')
  .pipe(
    tap(json => console.log('Container info:', json))
  )
  .subscribe();
```

### Process Spawning

```typescript
import { spawnPromise } from '@onivoro/server-process';

// Spawn a long-running process
const result = await spawnPromise('node', ['server.js'], {
  cwd: '/path/to/app',
  env: { ...process.env, NODE_ENV: 'production' }
});

console.log('Process exit code:', result.code);
console.log('Process output:', result.stdout);
```

### Docker Container Management

```typescript
import { Docker } from '@onivoro/server-process';

class ContainerManager {
  private docker = new Docker();

  async deployApplication(imageName: string, config: any): Promise<string> {
    // Pull latest image
    await this.docker.pull(imageName);

    // Stop existing container if running
    try {
      await this.docker.stop(config.containerName);
      await this.docker.remove(config.containerName);
    } catch (error) {
      // Container might not exist, continue
    }

    // Run new container
    const containerId = await this.docker.run(imageName, {
      name: config.containerName,
      ports: config.ports,
      volumes: config.volumes,
      env: config.environment,
      detach: true,
      restart: 'unless-stopped'
    });

    return containerId;
  }

  async getContainerLogs(containerName: string): Promise<string> {
    return this.docker.logs(containerName, { tail: 100 });
  }

  async healthCheck(containerName: string): Promise<boolean> {
    try {
      const result = await this.docker.exec(containerName, 'curl -f http://localhost/health');
      return result.exitCode === 0;
    } catch (error) {
      return false;
    }
  }
}
```

### Database Migration with PSql

```typescript
import { PSql } from '@onivoro/server-process';
import { readdir } from 'fs/promises';
import { join } from 'path';

class MigrationRunner {
  private psql: PSql;

  constructor(connectionConfig: any) {
    this.psql = new PSql(connectionConfig);
  }

  async runMigrations(migrationsDir: string): Promise<void> {
    // Ensure migrations table exists
    await this.psql.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get executed migrations
    const executedMigrations = await this.psql.query(
      'SELECT filename FROM migrations ORDER BY id'
    );
    const executedFiles = executedMigrations.map(row => row.filename);

    // Get migration files
    const files = await readdir(migrationsDir);
    const migrationFiles = files
      .filter(file => file.endsWith('.sql'))
      .sort();

    // Execute pending migrations
    for (const file of migrationFiles) {
      if (!executedFiles.includes(file)) {
        console.log(`Executing migration: ${file}`);
        
        try {
          await this.psql.executeFile(join(migrationsDir, file));
          await this.psql.query(
            'INSERT INTO migrations (filename) VALUES ($1)',
            [file]
          );
          console.log(`Migration ${file} completed successfully`);
        } catch (error) {
          console.error(`Migration ${file} failed:`, error);
          throw error;
        }
      }
    }
  }

  async rollback(steps: number = 1): Promise<void> {
    const migrations = await this.psql.query(
      'SELECT filename FROM migrations ORDER BY id DESC LIMIT $1',
      [steps]
    );

    for (const migration of migrations) {
      // Execute rollback script if exists
      const rollbackFile = migration.filename.replace('.sql', '.rollback.sql');
      try {
        await this.psql.executeFile(rollbackFile);
        await this.psql.query(
          'DELETE FROM migrations WHERE filename = $1',
          [migration.filename]
        );
        console.log(`Rolled back migration: ${migration.filename}`);
      } catch (error) {
        console.error(`Rollback failed for ${migration.filename}:`, error);
        throw error;
      }
    }
  }
}
```

### System Monitoring

```typescript
import { execPromise, execRxAsLines } from '@onivoro/server-process';

class SystemMonitor {
  async getSystemInfo(): Promise<any> {
    const [cpu, memory, disk] = await Promise.all([
      this.getCpuInfo(),
      this.getMemoryInfo(),
      this.getDiskInfo()
    ]);

    return { cpu, memory, disk };
  }

  private async getCpuInfo(): Promise<any> {
    const result = await execPromise('cat /proc/cpuinfo');
    // Parse CPU information
    return this.parseCpuInfo(result.stdout);
  }

  private async getMemoryInfo(): Promise<any> {
    const result = await execPromise('free -m');
    return this.parseMemoryInfo(result.stdout);
  }

  private async getDiskInfo(): Promise<any> {
    const result = await execPromise('df -h');
    return this.parseDiskInfo(result.stdout);
  }

  monitorSystemLogs(): void {
    execRxAsLines('tail -f /var/log/syslog')
      .subscribe(line => {
        if (this.isErrorLog(line)) {
          this.handleSystemError(line);
        }
      });
  }

  private isErrorLog(line: string): boolean {
    return line.toLowerCase().includes('error') || 
           line.toLowerCase().includes('fail');
  }

  private handleSystemError(errorLine: string): void {
    console.error('System error detected:', errorLine);
    // Implement alerting logic
  }
}
```

### Process Exit Handling

```typescript
import { exit, listen } from '@onivoro/server-process';

class GracefulShutdown {
  private cleanup: Array<() => Promise<void>> = [];

  addCleanupTask(task: () => Promise<void>): void {
    this.cleanup.push(task);
  }

  setupGracefulShutdown(): void {
    // Listen for termination signals
    listen('SIGTERM', async () => {
      console.log('Received SIGTERM, shutting down gracefully...');
      await this.performCleanup();
      exit(0);
    });

    listen('SIGINT', async () => {
      console.log('Received SIGINT, shutting down gracefully...');
      await this.performCleanup();
      exit(0);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error('Uncaught exception:', error);
      await this.performCleanup();
      exit(1);
    });
  }

  private async performCleanup(): Promise<void> {
    console.log('Performing cleanup tasks...');
    
    await Promise.all(
      this.cleanup.map(async (task, index) => {
        try {
          await task();
          console.log(`Cleanup task ${index + 1} completed`);
        } catch (error) {
          console.error(`Cleanup task ${index + 1} failed:`, error);
        }
      })
    );
  }
}

// Usage
const shutdown = new GracefulShutdown();

// Add cleanup tasks
shutdown.addCleanupTask(async () => {
  // Close database connections
  await database.close();
});

shutdown.addCleanupTask(async () => {
  // Stop background jobs
  await jobQueue.stop();
});

shutdown.setupGracefulShutdown();
```

## API Reference

### Command Execution

#### execPromise(command, options?)

Execute a command and return a promise:

```typescript
interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

function execPromise(command: string, options?: ExecOptions): Promise<ExecResult>
```

#### spawnPromise(command, args?, options?)

Spawn a process and return a promise:

```typescript
function spawnPromise(
  command: string, 
  args?: string[], 
  options?: SpawnOptions
): Promise<SpawnResult>
```

### Reactive Execution

#### execRx(command, options?)

Execute command reactively:

```typescript
function execRx(command: string, options?: ExecOptions): Observable<string>
```

#### execRxAsLines(command, options?)

Execute command and emit output line by line:

```typescript
function execRxAsLines(command: string, options?: ExecOptions): Observable<string>
```

#### execRxAsJson(command, options?)

Execute command and parse output as JSON:

```typescript
function execRxAsJson<T>(command: string, options?: ExecOptions): Observable<T>
```

### Docker Class

Docker container management:

```typescript
class Docker {
  async run(image: string, options?: DockerRunOptions): Promise<string>
  async stop(container: string): Promise<void>
  async remove(container: string): Promise<void>
  async exec(container: string, command: string): Promise<ExecResult>
  async logs(container: string, options?: LogOptions): Promise<string>
  async listContainers(): Promise<ContainerInfo[]>
  async pull(image: string): Promise<void>
}
```

### PSql Class

PostgreSQL operations:

```typescript
class PSql {
  constructor(config: PSqlConfig)
  async query(sql: string, params?: any[]): Promise<any[]>
  async executeFile(filePath: string): Promise<void>
  async transaction<T>(callback: (client: any) => Promise<T>): Promise<T>
}
```

### Process Management

#### listen(signal, callback)

Listen for process signals:

```typescript
function listen(signal: string, callback: () => void | Promise<void>): void
```

#### exit(code?)

Exit process with optional code:

```typescript
function exit(code?: number): never
```

## Best Practices

1. **Error Handling**: Always handle errors in process operations
2. **Resource Cleanup**: Use proper cleanup for long-running processes
3. **Signal Handling**: Implement graceful shutdown for production applications
4. **Stream Processing**: Use reactive streams for large outputs
5. **Security**: Validate input when executing external commands
6. **Logging**: Log process operations for debugging and monitoring
7. **Timeouts**: Set appropriate timeouts for long-running operations
8. **Environment**: Use environment-specific configurations

## Security Considerations

1. **Command Injection**: Always validate and sanitize command inputs
2. **Privilege Escalation**: Run processes with minimal required privileges
3. **Environment Variables**: Be careful with sensitive environment variables
4. **File Permissions**: Ensure proper file permissions for executed scripts
5. **Container Security**: Follow Docker security best practices

## Testing

```typescript
import { execPromise, Docker } from '@onivoro/server-process';

describe('Process Operations', () => {
  it('should execute commands', async () => {
    const result = await execPromise('echo "Hello World"');
    expect(result.stdout.trim()).toBe('Hello World');
    expect(result.code).toBe(0);
  });

  it('should handle command errors', async () => {
    try {
      await execPromise('nonexistent-command');
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.code).not.toBe(0);
    }
  });
});
```

## License

This library is part of the Onivoro monorepo ecosystem.