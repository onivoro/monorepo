import { Injectable } from '@nestjs/common';
import { RetryOptions, RetryResult } from '../types/retry.types';

@Injectable()
export class RetryService {

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {},
  ): Promise<RetryResult<T>> {
    const {
      maxAttempts = 3,
      baseDelay = 1000,
      maxDelay = 30000,
      backoffMultiplier = 2,
      jitter = true,
      retryableErrors = this.defaultRetryableErrors,
    } = options;

    let totalDelay = 0;
    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.debug(
          `[RetryService] Executing operation, attempt ${attempt}/${maxAttempts}`,
        );
        const result = await operation();

        if (attempt > 1) {
          console.log(
            `[RetryService] Operation succeeded on attempt ${attempt}/${maxAttempts} after ${totalDelay}ms`,
          );
        }

        return {
          result,
          attempts: attempt,
          totalDelay,
        };
      } catch (error) {
        lastError = error;

        console.warn(
          `[RetryService] Operation failed on attempt ${attempt}/${maxAttempts}`,
          {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
        );

        if (attempt === maxAttempts || !retryableErrors(error)) {
          console.error(
            `[RetryService] Operation failed permanently after ${attempt} attempts`,
            {
              totalDelay,
              finalError:
                error instanceof Error ? error.message : String(error),
            },
          );
          throw error;
        }

        const delay = this.calculateDelay(
          attempt,
          baseDelay,
          maxDelay,
          backoffMultiplier,
          jitter,
        );
        totalDelay += delay;

        console.debug(
          `[RetryService] Waiting ${delay}ms before retry ${attempt + 1}/${maxAttempts}`,
        );
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private calculateDelay(
    attempt: number,
    baseDelay: number,
    maxDelay: number,
    backoffMultiplier: number,
    jitter: boolean,
  ): number {
    let delay = baseDelay * Math.pow(backoffMultiplier, attempt - 1);
    delay = Math.min(delay, maxDelay);

    if (jitter) {
      // Add random jitter of ±25%
      const jitterRange = delay * 0.25;
      const jitterOffset = (Math.random() - 0.5) * 2 * jitterRange;
      delay = Math.max(0, delay + jitterOffset);
    }

    return Math.floor(delay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private defaultRetryableErrors(error: any): boolean {
    // Retry on common transient errors
    if (error.code) {
      // Network errors
      if (
        ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'].includes(
          error.code,
        )
      ) {
        return true;
      }

      // Database connection errors
      if (['ER_LOCK_WAIT_TIMEOUT', 'ER_LOCK_DEADLOCK'].includes(error.code)) {
        return true;
      }
    }

    // HTTP status codes that should be retried
    if (error.status || error.statusCode) {
      const status = error.status || error.statusCode;
      // Retry on 5xx server errors and 429 rate limiting
      if (status >= 500 || status === 429) {
        return true;
      }
    }

    // AWS service errors that should be retried
    if (error.name) {
      const retryableAwsErrors = [
        'ThrottlingException',
        'ServiceUnavailableException',
        'InternalServerError',
        'RequestTimeout',
      ];
      if (retryableAwsErrors.includes(error.name)) {
        return true;
      }
    }

    return false;
  }
}
