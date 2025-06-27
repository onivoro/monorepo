import { Module } from '@nestjs/common';
import { HealthController } from './controllers/health.controller';
import { moduleFactory } from './functions/module-factory.function';
import { versionProvider } from './providers/version.provider';

@Module(
  moduleFactory({
    controllers: [HealthController],
    providers: [
      versionProvider
    ],
  })
)
export class ServerCommonModule { }
