import { Injectable } from '@nestjs/common';
import { SemaphoreService } from './semaphore.service';
import { ConcurrencyManagerOptions } from '../types/retry.types';

@Injectable()
export class ConcurrencyManager {
  private readonly semaphore: SemaphoreService;
  private readonly enableMetrics: boolean;
  private metrics = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    totalWaitTime: 0,
    maxWaitTime: 0,
    averageExecutionTime: 0,
  };

  constructor(options: ConcurrencyManagerOptions) {
    const {
      maxConcurrency,
      queueTimeout = 30000,
      enableMetrics = true,
    } = options;
    this.semaphore = new SemaphoreService(maxConcurrency, queueTimeout);
    this.enableMetrics = enableMetrics;

    console.log(
      `[ConcurrencyManager] Initialized with max concurrency: ${maxConcurrency}`,
    );
  }

  async executeWithConcurrencyLimit<T>(
    operation: () => Promise<T>,
    operationId?: string,
  ): Promise<T> {
    const startTime = Date.now();
    const waitStartTime = Date.now();

    await this.semaphore.acquire();
    const waitTime = Date.now() - waitStartTime;

    if (this.enableMetrics) {
      this.updateWaitMetrics(waitTime);
    }

    console.debug(
      `[ConcurrencyManager] Operation ${operationId || 'unknown'} acquired semaphore after ${waitTime}ms`,
    );

    try {
      const result = await operation();
      const executionTime = Date.now() - startTime;

      if (this.enableMetrics) {
        this.updateSuccessMetrics(executionTime);
      }

      console.debug(
        `[ConcurrencyManager] Operation ${operationId || 'unknown'} completed successfully in ${executionTime}ms`,
      );
      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      if (this.enableMetrics) {
        this.updateFailureMetrics(executionTime);
      }

      console.error(
        `[ConcurrencyManager] Operation ${operationId || 'unknown'} failed after ${executionTime}ms`,
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );
      throw error;
    } finally {
      this.semaphore.release();
    }
  }

  async executeAllWithConcurrencyLimit<T>(
    operations: Array<() => Promise<T>>,
    operationPrefix?: string,
  ): Promise<
    Array<{ status: 'fulfilled' | 'rejected'; value?: T; reason?: any }>
  > {
    console.log(
      `[ConcurrencyManager] Executing ${operations.length} operations with concurrency control`,
    );

    const promises = operations.map((operation, index) =>
      this.executeWithConcurrencyLimit(
        operation,
        `${operationPrefix || 'batch'}-${index}`,
      ).then(
        (value) => ({ status: 'fulfilled' as const, value }),
        (reason) => ({ status: 'rejected' as const, reason }),
      ),
    );

    const results = await Promise.all(promises);

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    console.log(
      `[ConcurrencyManager] Batch execution completed: ${successful} successful, ${failed} failed`,
    );

    return results;
  }

  getStatus() {
    return {
      semaphore: this.semaphore.getStatus(),
      metrics: this.enableMetrics ? { ...this.metrics } : null,
      queueWaitTimes: this.semaphore.getQueueWaitTimes(),
    };
  }

  resetMetrics() {
    this.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalWaitTime: 0,
      maxWaitTime: 0,
      averageExecutionTime: 0,
    };
    console.debug('[ConcurrencyManager] Metrics reset');
  }

  private updateWaitMetrics(waitTime: number) {
    this.metrics.totalWaitTime += waitTime;
    this.metrics.maxWaitTime = Math.max(this.metrics.maxWaitTime, waitTime);
  }

  private updateSuccessMetrics(executionTime: number) {
    this.metrics.totalExecutions++;
    this.metrics.successfulExecutions++;
    this.updateAverageExecutionTime(executionTime);
  }

  private updateFailureMetrics(executionTime: number) {
    this.metrics.totalExecutions++;
    this.metrics.failedExecutions++;
    this.updateAverageExecutionTime(executionTime);
  }

  private updateAverageExecutionTime(executionTime: number) {
    const total =
      this.metrics.averageExecutionTime * (this.metrics.totalExecutions - 1) +
      executionTime;
    this.metrics.averageExecutionTime = total / this.metrics.totalExecutions;
  }
}
