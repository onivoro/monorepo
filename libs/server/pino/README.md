# @onivoro/server-pino

A comprehensive Pino logging integration library for NestJS applications, providing structured logging, console patching, and enterprise-grade logging configuration with built-in performance optimizations.

## Installation

```bash
npm install @onivoro/server-pino
```

## Features

- **Pino Integration**: High-performance structured logging with Pino
- **NestJS Module**: Ready-to-use module with dependency injection
- **Console Patching**: Automatic console method replacement with structured logging
- **Configuration Management**: Strongly-typed configuration with environment variables
- **Performance Optimized**: Asynchronous logging for minimal performance impact
- **Structured Logging**: JSON-formatted logs with consistent structure
- **Log Levels**: Configurable log levels (trace, debug, info, warn, error, fatal)
- **Request Correlation**: Built-in request ID tracking for distributed systems

## Quick Start

### Import the Module

```typescript
import { ServerPinoModule } from '@onivoro/server-pino';

@Module({
  imports: [ServerPinoModule],
})
export class AppModule {}
```

### Basic Configuration

```typescript
import { ServerPinoConfig } from '@onivoro/server-pino';

// Environment variables
// LOG_LEVEL=info
// LOG_PRETTY=false
// LOG_DESTINATION=stdout
```

### Enable Console Patching

```typescript
import { patchConsole } from '@onivoro/server-pino';

// Patch console methods to use Pino
patchConsole();

// Now console.log, console.error, etc. will use structured logging
console.log('Hello world'); // Outputs structured JSON log
console.error('Error occurred', { error: 'details' });
```

## Configuration

### Environment Variables

```bash
# Log level (trace, debug, info, warn, error, fatal)
LOG_LEVEL=info

# Pretty print logs (useful for development)
LOG_PRETTY=true

# Log destination (stdout, stderr, or file path)
LOG_DESTINATION=stdout

# Enable/disable request logging
LOG_REQUESTS=true

# Log file rotation (if using file destination)
LOG_MAX_FILES=10
LOG_MAX_SIZE=10m
```

### Configuration Class

```typescript
import { ServerPinoConfig, EnvironmentClass } from '@onivoro/server-pino';

@EnvironmentClass()
export class CustomPinoConfig extends ServerPinoConfig {
  @EnvironmentVariable('LOG_LEVEL', 'info')
  logLevel: string;

  @EnvironmentVariable('LOG_PRETTY', 'false')
  prettyPrint: boolean;

  @EnvironmentVariable('LOG_DESTINATION', 'stdout')
  destination: string;
}
```

## Usage Examples

### Basic Logging

```typescript
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MyService {
  private readonly logger = new Logger(MyService.name);

  async performOperation(data: any): Promise<void> {
    this.logger.log('Starting operation', { data });
    
    try {
      // Perform operation
      this.logger.debug('Operation step completed', { step: 1 });
      
      this.logger.log('Operation completed successfully');
    } catch (error) {
      this.logger.error('Operation failed', error.stack, { 
        error: error.message,
        data 
      });
      throw error;
    }
  }
}
```

### Console Patching

```typescript
import { patchConsole } from '@onivoro/server-pino';

// Apply console patching early in your application
patchConsole();

// Now all console methods produce structured logs
console.log('User logged in', { userId: '123', timestamp: new Date() });
console.error('Database connection failed', { 
  host: 'localhost',
  port: 5432,
  error: 'Connection timeout'
});
console.warn('Deprecated API usage', { 
  endpoint: '/api/v1/users',
  suggestion: 'Use /api/v2/users instead'
});
```

### Advanced Configuration

```typescript
import { Module } from '@nestjs/common';
import { ServerPinoModule } from '@onivoro/server-pino';

@Module({
  imports: [
    ServerPinoModule.forRoot({
      level: 'info',
      prettyPrint: process.env.NODE_ENV === 'development',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      },
      serializers: {
        req: (req) => ({
          method: req.method,
          url: req.url,
          headers: req.headers,
          remoteAddress: req.remoteAddress,
          remotePort: req.remotePort
        }),
        res: (res) => ({
          statusCode: res.statusCode,
          headers: res.headers
        })
      }
    })
  ],
})
export class AppModule {}
```

### Request Logging

```typescript
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(LoggingMiddleware.name);

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const { method, originalUrl, headers, body } = req;
    
    // Log incoming request
    this.logger.log('Incoming request', {
      method,
      url: originalUrl,
      userAgent: headers['user-agent'],
      contentLength: headers['content-length'],
      requestId: req.headers['x-request-id']
    });

    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      this.logger.log('Request completed', {
        method,
        url: originalUrl,
        statusCode: res.statusCode,
        duration,
        requestId: req.headers['x-request-id']
      });
    });

    next();
  }
}
```

### Error Logging

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';

@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status = exception instanceof HttpException 
      ? exception.getStatus() 
      : 500;

    const message = exception instanceof HttpException
      ? exception.message
      : 'Internal server error';

    // Structured error logging
    this.logger.error('Exception caught', {
      error: {
        message,
        stack: exception instanceof Error ? exception.stack : undefined,
        status
      },
      request: {
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: request.body,
        requestId: request.headers['x-request-id']
      },
      timestamp: new Date().toISOString()
    });

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url
    });
  }
}
```

### Performance Logging

```typescript
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PerformanceService {
  private readonly logger = new Logger(PerformanceService.name);

  async measurePerformance<T>(
    operation: () => Promise<T>,
    operationName: string,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();

    try {
      const result = await operation();
      const endTime = process.hrtime.bigint();
      const endMemory = process.memoryUsage();
      
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      const memoryDelta = {
        rss: endMemory.rss - startMemory.rss,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal
      };

      this.logger.log('Performance measurement', {
        operation: operationName,
        duration,
        memory: {
          before: startMemory,
          after: endMemory,
          delta: memoryDelta
        },
        metadata
      });

      return result;
    } catch (error) {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;

      this.logger.error('Performance measurement failed', {
        operation: operationName,
        duration,
        error: error.message,
        metadata
      });

      throw error;
    }
  }
}
```

### Contextual Logging

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

interface LogContext {
  requestId?: string;
  userId?: string;
  operationId?: string;
  correlationId?: string;
}

@Injectable()
export class ContextualLogger {
  private readonly logger = new Logger(ContextualLogger.name);
  private readonly context = new AsyncLocalStorage<LogContext>();

  setContext(context: LogContext): void {
    this.context.enterWith(context);
  }

  log(message: string, data?: any): void {
    const context = this.context.getStore();
    this.logger.log(message, { ...data, context });
  }

  error(message: string, trace?: string, data?: any): void {
    const context = this.context.getStore();
    this.logger.error(message, trace, { ...data, context });
  }

  warn(message: string, data?: any): void {
    const context = this.context.getStore();
    this.logger.warn(message, { ...data, context });
  }

  debug(message: string, data?: any): void {
    const context = this.context.getStore();
    this.logger.debug(message, { ...data, context });
  }
}
```

## API Reference

### ServerPinoConfig

Configuration class for Pino logging:

```typescript
@EnvironmentClass()
export class ServerPinoConfig {
  @EnvironmentVariable('LOG_LEVEL', 'info')
  logLevel: string;

  @EnvironmentVariable('LOG_PRETTY', 'false')
  prettyPrint: boolean;

  @EnvironmentVariable('LOG_DESTINATION', 'stdout')
  destination: string;

  @EnvironmentVariable('LOG_REQUESTS', 'true')
  logRequests: boolean;
}
```

### Functions

#### patchConsole

Patch console methods to use structured logging:

```typescript
function patchConsole(options?: {
  logLevel?: string;
  includeStack?: boolean;
  formatters?: Record<string, (args: any[]) => any>;
}): void
```

### Log Levels

Available log levels in order of severity:

1. **trace** - Most detailed information
2. **debug** - Detailed information for debugging
3. **info** - General information about application flow
4. **warn** - Warning messages for potentially harmful situations
5. **error** - Error events that allow the application to continue
6. **fatal** - Critical errors that might cause the application to abort

### Structured Log Format

All logs follow this structure:

```json
{
  "level": 30,
  "time": 1640995200000,
  "pid": 12345,
  "hostname": "server-01",
  "msg": "User logged in",
  "userId": "123",
  "requestId": "req-456",
  "v": 1
}
```

## Best Practices

1. **Use Structured Data**: Always include relevant context in log messages
2. **Consistent Log Levels**: Use appropriate log levels for different types of messages
3. **Request Correlation**: Include request IDs for tracing requests across services
4. **Avoid Sensitive Data**: Never log passwords, tokens, or other sensitive information
5. **Performance Monitoring**: Use performance logging for critical operations
6. **Error Context**: Include full error context when logging exceptions
7. **Log Rotation**: Configure log rotation for production environments
8. **Centralized Logging**: Use centralized logging systems in production

## Integration with Monitoring Systems

### ELK Stack

```typescript
// Configure for Elasticsearch ingestion
const pinoConfig = {
  level: 'info',
  formatters: {
    timestamp: () => ({ '@timestamp': new Date().toISOString() }),
    level: (level) => ({ level: level })
  }
};
```

### AWS CloudWatch

```typescript
// Use AWS CloudWatch transport
const pinoConfig = {
  transport: {
    target: 'pino-cloudwatch',
    options: {
      logGroup: '/aws/lambda/my-function',
      logStream: 'my-stream',
      region: 'us-east-1'
    }
  }
};
```

## Testing

```typescript
import { Test } from '@nestjs/testing';
import { ServerPinoModule } from '@onivoro/server-pino';
import { Logger } from '@nestjs/common';

describe('Pino Logging', () => {
  let logger: Logger;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [ServerPinoModule],
    }).compile();

    logger = module.get<Logger>(Logger);
  });

  it('should log messages', () => {
    const logSpy = jest.spyOn(logger, 'log');
    
    logger.log('Test message', { data: 'test' });
    
    expect(logSpy).toHaveBeenCalledWith('Test message', { data: 'test' });
  });
});
```

## License

This library is licensed under the MIT License. See the LICENSE file in this package for details.