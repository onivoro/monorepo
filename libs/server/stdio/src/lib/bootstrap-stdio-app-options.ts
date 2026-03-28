import { LoggerService } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

export interface BootstrapStdioAppOptions {
  logger?: LoggerService | false;
  onReady?: (
    app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>>,
  ) => void | Promise<void>;
}
