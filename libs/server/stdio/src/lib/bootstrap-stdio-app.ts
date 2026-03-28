import { NestFactory } from '@nestjs/core';
import { Type } from '@nestjs/common';
import { StdioTransportService } from './stdio-transport-service';
import { BootstrapStdioAppOptions } from './bootstrap-stdio-app-options';
import { patchConsoleForStdio } from './patch-console-for-stdio';

export async function bootstrapStdioApp(
  module: Type<unknown>,
  options: BootstrapStdioAppOptions = {},
): Promise<void> {
  const { logger = console, onReady } = options;

  patchConsoleForStdio();

  const app = await NestFactory.createApplicationContext(module, {
    bufferLogs: true,
  });

  app.useLogger(logger);
  app.flushLogs();

  await app.init();

  try {
    const transportService = app.get(StdioTransportService);
    const methods = transportService.getTransport().getRegisteredMethods();
    console.log(`[StdioApp] Ready with ${methods.length} registered handlers`);
  } catch {
    console.warn(
      '[StdioApp] Warning: StdioTransportService not found. ' +
        'Did you import StdioTransportModule.forRoot() in your module?',
    );
  }

  if (onReady) {
    await onReady(app);
  }

  const shutdown = async (signal: string) => {
    console.log(`[StdioApp] Received ${signal}, shutting down...`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  console.log('[StdioApp] Stdio server started');
}
