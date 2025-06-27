export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  jitter?: boolean;
  retryableErrors?: (error: any) => boolean;
}

export interface RetryResult<T> {
  result: T;
  attempts: number;
  totalDelay: number;
}

export interface SemaphoreOptions {
  maxConcurrency: number;
  timeout?: number;
}

export interface ConcurrencyManagerOptions {
  maxConcurrency: number;
  queueTimeout?: number;
  enableMetrics?: boolean;
}
