import { Injectable } from '@nestjs/common';

interface SemaphoreAcquisition {
  resolve: () => void;
  reject: (error: Error) => void;
  timestamp: number;
}

@Injectable()
export class SemaphoreService {
  private available: number;
  private readonly queue: SemaphoreAcquisition[] = [];
  private readonly timeout: number;

  constructor(
    private readonly maxConcurrency: number,
    timeout: number = 30000,
  ) {
    this.available = maxConcurrency;
    this.timeout = timeout;
    console.debug(
      `[Semaphore] Created with max concurrency: ${maxConcurrency}`,
    );
  }

  async acquire(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.available > 0) {
        this.available--;
        console.debug(
          `[Semaphore] Acquired immediately, available: ${this.available}`,
        );
        resolve();
        return;
      }

      const acquisition: SemaphoreAcquisition = {
        resolve,
        reject,
        timestamp: Date.now(),
      };

      this.queue.push(acquisition);
      console.debug(`[Semaphore] Queued, queue length: ${this.queue.length}`);

      // Set timeout for acquisition
      setTimeout(() => {
        const index = this.queue.indexOf(acquisition);
        if (index !== -1) {
          this.queue.splice(index, 1);
          reject(
            new Error(
              `Semaphore acquisition timed out after ${this.timeout}ms`,
            ),
          );
        }
      }, this.timeout);
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const acquisition = this.queue.shift()!;
      console.debug(
        `[Semaphore] Released from queue, remaining: ${this.queue.length}`,
      );
      acquisition.resolve();
    } else {
      this.available++;
      console.debug(`[Semaphore] Released, available: ${this.available}`);
    }
  }

  getStatus() {
    return {
      maxConcurrency: this.maxConcurrency,
      available: this.available,
      queueLength: this.queue.length,
      inUse: this.maxConcurrency - this.available,
    };
  }

  getQueueWaitTimes(): number[] {
    const now = Date.now();
    return this.queue.map((acquisition) => now - acquisition.timestamp);
  }
}
