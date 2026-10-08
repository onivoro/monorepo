jest.mock('./init-openapi.function', () => ({
  initOpenapi: jest.fn().mockResolvedValue('path'),
}));

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createApiApp } from './create-api-app.function';
import { initOpenapi } from './init-openapi.function';

describe('createApiApp', () => {
  class AppModule {}
  let app: Record<string, jest.Mock>;
  let create: jest.SpyInstance;
  let loggerLog: jest.SpyInstance;

  beforeEach(() => {
    app = {
      use: jest.fn(),
      setGlobalPrefix: jest.fn(),
      enableCors: jest.fn(),
      enableShutdownHooks: jest.fn(),
      listen: jest.fn().mockResolvedValue(undefined),
    };
    create = jest.spyOn(NestFactory, 'create').mockResolvedValue(app as any);
    loggerLog = jest.spyOn(Logger, 'log').mockImplementation(() => undefined);
    (initOpenapi as jest.Mock).mockClear();
  });

  afterEach(() => {
    create.mockRestore();
    loggerLog.mockRestore();
  });

  it('creates, configures and starts the app with the default "api" prefix', async () => {
    const result = await createApiApp(
      AppModule,
      3000,
      'server-api',
      'apps/api',
    );

    expect(result).toBe(app);
    expect(create).toHaveBeenCalledWith(AppModule, { logger: console });
    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api');
    expect(app.enableCors).toHaveBeenCalledWith(undefined);
    expect(app.enableShutdownHooks).toHaveBeenCalled();
    expect(app.use).toHaveBeenCalledTimes(2);
    expect(initOpenapi).toHaveBeenCalledWith(
      app,
      'AppModule',
      'server-api',
      'apps/api',
    );
    expect(app.listen).toHaveBeenCalledWith(3000);
    expect(loggerLog).toHaveBeenCalledWith(
      expect.stringContaining('http://localhost:3000/api'),
    );
  });

  it('uses the given cors options and prefix', async () => {
    const cors = { origin: '*' };

    await createApiApp(AppModule, 8080, 'p', 'r', cors, 'v1');

    expect(app.enableCors).toHaveBeenCalledWith(cors);
    expect(app.setGlobalPrefix).toHaveBeenCalledWith('v1');
    expect(loggerLog).toHaveBeenCalledWith(
      expect.stringContaining('http://localhost:8080/v1'),
    );
  });
});
