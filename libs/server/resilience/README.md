# @onivoro/server-resilience

A comprehensive resilience patterns library for Node.js applications, providing retry mechanisms, circuit breakers, concurrency management, and semaphore controls to build fault-tolerant and reliable systems.

## Installation

```bash
npm install @onivoro/server-resilience
```

## Features

- **Retry Service**: Configurable retry logic with exponential backoff and jitter
- **Concurrency Manager**: Manage concurrent operations with rate limiting
- **Semaphore Service**: Control resource access with counting semaphores
- **Circuit Breaker**: Prevent cascading failures with circuit breaker pattern
- **NestJS Module**: Ready-to-use module with dependency injection
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Flexible Configuration**: Highly configurable with sensible defaults
- **Error Classification**: Smart error classification for retry decisions

## Quick Start

### Import the Module

```typescript
import { ResilienceModule } from '@onivoro/server-resilience';

@Module({
  imports: [ResilienceModule],
})
export class AppModule {}
```

### Basic Retry Usage

```typescript
import { Injectable } from '@nestjs/common';
import { RetryService } from '@onivoro/server-resilience';

@Injectable()
export class ApiService {
  constructor(private retryService: RetryService) {}

  async fetchUserData(userId: string): Promise<User> {
    return this.retryService.executeWithRetry(
      async () => {
        const response = await fetch(`/api/users/${userId}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      },
      {
        maxAttempts: 3,
        baseDelay: 1000,
        backoffMultiplier: 2
      }
    );
  }
}
```

### Concurrency Management

```typescript
import { Injectable } from '@nestjs/common';
import { ConcurrencyManagerService } from '@onivoro/server-resilience';

@Injectable()
export class ProcessingService {
  constructor(private concurrencyManager: ConcurrencyManagerService) {}

  async processItems(items: any[]): Promise<void> {
    await this.concurrencyManager.executeWithLimit(
      items.map(item => () => this.processItem(item)),
      { maxConcurrency: 5 }
    );
  }

  private async processItem(item: any): Promise<void> {
    // Process individual item
  }
}
```

## Configuration

### Retry Configuration

```typescript
import { RetryOptions } from '@onivoro/server-resilience';

const retryOptions: RetryOptions = {
  maxAttempts: 5,              // Maximum number of attempts
  baseDelay: 1000,             // Base delay in milliseconds
  maxDelay: 30000,             // Maximum delay cap
  backoffMultiplier: 2,        // Exponential backoff multiplier
  jitter: true,                // Add random jitter to prevent thundering herd
  retryableErrors: (error) => {
    // Custom error classification logic
    return error.code === 'NETWORK_ERROR' || error.status >= 500;
  }
};
```

### Concurrency Configuration

```typescript
import { ConcurrencyOptions } from '@onivoro/server-resilience';

const concurrencyOptions: ConcurrencyOptions = {
  maxConcurrency: 10,          // Maximum concurrent operations
  queueSize: 100,              // Maximum queue size
  timeout: 30000,              // Operation timeout
  batchSize: 5,                // Process in batches
  delayBetweenBatches: 1000    // Delay between batches
};
```

## Usage Examples

### Advanced Retry with Custom Error Handling

```typescript
import { Injectable } from '@nestjs/common';
import { RetryService, RetryOptions } from '@onivoro/server-resilience';

@Injectable()
export class DatabaseService {
  constructor(private retryService: RetryService) {}

  async executeQuery(query: string): Promise<any> {
    const retryOptions: RetryOptions = {
      maxAttempts: 5,
      baseDelay: 500,
      maxDelay: 10000,
      backoffMultiplier: 1.5,
      jitter: true,
      retryableErrors: (error) => {
        // Retry on connection errors and deadlocks
        const retryableCodes = [
          'ER_LOCK_WAIT_TIMEOUT',
          'ER_LOCK_DEADLOCK',
          'ECONNRESET',
          'ENOTFOUND'
        ];
        return retryableCodes.includes(error.code) || error.status >= 500;
      }
    };

    const result = await this.retryService.executeWithRetry(
      async () => {
        return this.database.query(query);
      },
      retryOptions
    );

    console.log(`Query executed successfully after ${result.attempts} attempts`);
    return result.result;
  }
}
```

### Semaphore for Resource Management

```typescript
import { Injectable } from '@nestjs/common';
import { SemaphoreService } from '@onivoro/server-resilience';

@Injectable()
export class FileProcessingService {
  private fileSemaphore: SemaphoreService;

  constructor() {
    // Limit to 3 concurrent file operations
    this.fileSemaphore = new SemaphoreService(3);
  }

  async processFile(filePath: string): Promise<void> {
    return this.fileSemaphore.acquire(async () => {
      console.log(`Processing file: ${filePath}`);
      // Simulate file processing
      await this.readAndProcessFile(filePath);
      console.log(`Completed processing: ${filePath}`);
    });
  }

  async processBatchFiles(filePaths: string[]): Promise<void> {
    const promises = filePaths.map(path => this.processFile(path));
    await Promise.all(promises);
  }

  private async readAndProcessFile(filePath: string): Promise<void> {
    // File processing logic here
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}
```

### Combining Retry and Concurrency Management

```typescript
import { Injectable } from '@nestjs/common';
import { RetryService, ConcurrencyManagerService } from '@onivoro/server-resilience';

@Injectable()
export class ApiIntegrationService {
  constructor(
    private retryService: RetryService,
    private concurrencyManager: ConcurrencyManagerService
  ) {}

  async syncUsersFromExternalApi(): Promise<void> {
    const userIds = await this.getUserIds();
    
    // Process users with concurrency control and retry logic
    await this.concurrencyManager.executeWithLimit(
      userIds.map(id => () => this.syncUser(id)),
      { maxConcurrency: 5 }
    );
  }

  private async syncUser(userId: string): Promise<void> {
    return this.retryService.executeWithRetry(
      async () => {
        const userData = await this.fetchUserFromApi(userId);
        await this.saveUserToDatabase(userData);
      },
      {
        maxAttempts: 3,
        baseDelay: 1000,
        retryableErrors: (error) => {
          // Retry on rate limiting and server errors
          return error.status === 429 || error.status >= 500;
        }
      }
    );
  }

  private async fetchUserFromApi(userId: string): Promise<any> {
    // API call implementation
  }

  private async saveUserToDatabase(userData: any): Promise<void> {
    // Database save implementation
  }

  private async getUserIds(): Promise<string[]> {
    // Get user IDs implementation
  }
}
```

### Circuit Breaker Pattern

```typescript
import { Injectable } from '@nestjs/common';
import { RetryService } from '@onivoro/server-resilience';

@Injectable()
export class CircuitBreakerService {
  private isCircuitOpen = false;
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold = 5;
  private readonly recoveryTimeout = 60000; // 1 minute

  constructor(private retryService: RetryService) {}

  async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    if (this.isCircuitOpen) {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        console.log(`Circuit breaker recovering for ${operationName}`);
        this.isCircuitOpen = false;
        this.failureCount = 0;
      } else {
        throw new Error(`Circuit breaker is open for ${operationName}`);
      }
    }

    try {
      const result = await this.retryService.executeWithRetry(
        operation,
        {
          maxAttempts: 2,
          baseDelay: 500
        }
      );

      // Reset failure count on success
      this.failureCount = 0;
      return result.result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.failureThreshold) {
        console.log(`Circuit breaker opened for ${operationName}`);
        this.isCircuitOpen = true;
      }

      throw error;
    }
  }
}
```

### Batch Processing with Rate Limiting

```typescript
import { Injectable } from '@nestjs/common';
import { ConcurrencyManagerService, SemaphoreService } from '@onivoro/server-resilience';

@Injectable()
export class BatchProcessorService {
  private rateLimitSemaphore: SemaphoreService;

  constructor(private concurrencyManager: ConcurrencyManagerService) {
    // Rate limit: 10 requests per second
    this.rateLimitSemaphore = new SemaphoreService(10);
    this.resetRateLimit();
  }

  async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options: {
      batchSize?: number;
      delayBetweenBatches?: number;
      maxConcurrency?: number;
    } = {}
  ): Promise<R[]> {
    const {
      batchSize = 50,
      delayBetweenBatches = 1000,
      maxConcurrency = 5
    } = options;

    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)}`);
      
      const batchResults = await this.concurrencyManager.executeWithLimit(
        batch.map(item => () => this.processWithRateLimit(item, processor)),
        { maxConcurrency }
      );
      
      results.push(...batchResults);
      
      // Delay between batches to prevent overwhelming the system
      if (i + batchSize < items.length) {
        await this.delay(delayBetweenBatches);
      }
    }

    return results;
  }

  private async processWithRateLimit<T, R>(
    item: T,
    processor: (item: T) => Promise<R>
  ): Promise<R> {
    return this.rateLimitSemaphore.acquire(() => processor(item));
  }

  private resetRateLimit(): void {
    // Reset rate limit every second
    setInterval(() => {
      this.rateLimitSemaphore.release(10);
    }, 1000);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Health Check with Resilience

```typescript
import { Injectable } from '@nestjs/common';
import { RetryService } from '@onivoro/server-resilience';

@Injectable()
export class HealthCheckService {
  constructor(private retryService: RetryService) {}

  async checkSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, any>;
  }> {
    const services = {
      database: await this.checkDatabase(),
      externalApi: await this.checkExternalApi(),
      cache: await this.checkCache()
    };

    const healthyCount = Object.values(services).filter(s => s.status === 'healthy').length;
    const totalCount = Object.keys(services).length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyCount === totalCount) {
      status = 'healthy';
    } else if (healthyCount > 0) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return { status, services };
  }

  private async checkDatabase(): Promise<any> {
    try {
      const result = await this.retryService.executeWithRetry(
        async () => {
          // Database health check
          await this.database.query('SELECT 1');
          return true;
        },
        {
          maxAttempts: 2,
          baseDelay: 500
        }
      );

      return {
        status: 'healthy',
        responseTime: result.totalDelay,
        attempts: result.attempts
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  private async checkExternalApi(): Promise<any> {
    try {
      const result = await this.retryService.executeWithRetry(
        async () => {
          const response = await fetch('/api/health');
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        },
        {
          maxAttempts: 2,
          baseDelay: 1000
        }
      );

      return {
        status: 'healthy',
        responseTime: result.totalDelay
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  private async checkCache(): Promise<any> {
    // Similar implementation for cache check
    return { status: 'healthy' };
  }
}
```

## API Reference

### RetryService

Main service for retry operations:

```typescript
@Injectable()
export class RetryService {
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options?: RetryOptions
  ): Promise<RetryResult<T>>
}
```

### ConcurrencyManagerService

Service for managing concurrent operations:

```typescript
@Injectable()
export class ConcurrencyManagerService {
  async executeWithLimit<T>(
    operations: Array<() => Promise<T>>,
    options?: ConcurrencyOptions
  ): Promise<T[]>
}
```

### SemaphoreService

Service for semaphore-based resource control:

```typescript
export class SemaphoreService {
  constructor(permits: number)
  
  async acquire<T>(operation: () => Promise<T>): Promise<T>
  release(permits?: number): void
  availablePermits(): number
}
```

### Type Definitions

#### RetryOptions

```typescript
interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  jitter?: boolean;
  retryableErrors?: (error: any) => boolean;
}
```

#### RetryResult

```typescript
interface RetryResult<T> {
  result: T;
  attempts: number;
  totalDelay: number;
}
```

#### ConcurrencyOptions

```typescript
interface ConcurrencyOptions {
  maxConcurrency?: number;
  queueSize?: number;
  timeout?: number;
  batchSize?: number;
  delayBetweenBatches?: number;
}
```

## Best Practices

1. **Error Classification**: Implement smart error classification for retry decisions
2. **Exponential Backoff**: Use exponential backoff with jitter to prevent thundering herd
3. **Circuit Breakers**: Implement circuit breakers for external service calls
4. **Resource Limits**: Use semaphores to control resource access
5. **Monitoring**: Monitor retry attempts and failure rates
6. **Timeout Management**: Set appropriate timeouts for operations
7. **Graceful Degradation**: Implement fallback mechanisms
8. **Testing**: Test resilience patterns under failure conditions

## Monitoring and Observability

```typescript
import { Injectable } from '@nestjs/common';
import { RetryService } from '@onivoro/server-resilience';

@Injectable()
export class MonitoredService {
  private metrics = {
    retryAttempts: 0,
    successfulRetries: 0,
    failedRetries: 0
  };

  constructor(private retryService: RetryService) {}

  async executeWithMonitoring<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await this.retryService.executeWithRetry(operation, {
        maxAttempts: 3,
        baseDelay: 1000
      });

      this.metrics.retryAttempts += result.attempts;
      if (result.attempts > 1) {
        this.metrics.successfulRetries++;
      }

      console.log(`${operationName} completed in ${Date.now() - startTime}ms after ${result.attempts} attempts`);
      
      return result.result;
    } catch (error) {
      this.metrics.failedRetries++;
      console.error(`${operationName} failed after retries:`, error);
      throw error;
    }
  }

  getMetrics() {
    return { ...this.metrics };
  }
}
```

## Testing

```typescript
import { Test } from '@nestjs/testing';
import { ResilienceModule, RetryService } from '@onivoro/server-resilience';

describe('RetryService', () => {
  let service: RetryService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [ResilienceModule],
    }).compile();

    service = module.get<RetryService>(RetryService);
  });

  it('should retry failed operations', async () => {
    let attempts = 0;
    const operation = jest.fn().mockImplementation(async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Temporary failure');
      }
      return 'success';
    });

    const result = await service.executeWithRetry(operation, {
      maxAttempts: 3,
      baseDelay: 100
    });

    expect(result.result).toBe('success');
    expect(result.attempts).toBe(3);
    expect(operation).toHaveBeenCalledTimes(3);
  });
});
```

## License

This library is part of the Onivoro monorepo ecosystem.