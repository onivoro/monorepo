import { Module } from '@nestjs/common';
import { RetryService } from './services/retry.service';
import { ConcurrencyManager } from './services/concurrency-manager.service';
import { moduleFactory } from '@onivoro/server-common';
import { SemaphoreService } from './services/semaphore.service';

@Module({})
export class ResilienceModule {
  static configure() {
    return moduleFactory({
      providers: [
        RetryService,
        SemaphoreService,
        {
          provide: ConcurrencyManager,
          useFactory: () =>
            new ConcurrencyManager({
              maxConcurrency: 10,
              queueTimeout: 60000,
              enableMetrics: true,
            }),
        },
      ],
    });
  }
}
