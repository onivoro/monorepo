jest.mock('./init-openapi.function', () => ({
  initOpenapi: jest.fn().mockResolvedValue('path'),
}));

import { NestFactory } from '@nestjs/core';
import { configureApiApp } from './configure-api-app.function';
import { initOpenapi } from './init-openapi.function';

function createFakeApp() {
  return {
    use: jest.fn(),
    setGlobalPrefix: jest.fn(),
    enableCors: jest.fn(),
    enableShutdownHooks: jest.fn(),
  };
}

describe('configureApiApp', () => {
  class AppModule {}
  let app: ReturnType<typeof createFakeApp>;
  let create: jest.SpyInstance;

  beforeEach(() => {
    app = createFakeApp();
    create = jest.spyOn(NestFactory, 'create').mockResolvedValue(app as any);
    (initOpenapi as jest.Mock).mockClear();
  });

  afterEach(() => {
    create.mockRestore();
  });

  it('creates and configures the app with defaults', async () => {
    const result = await configureApiApp(AppModule, {
      project: 'server-api',
      appRoot: 'apps/api',
    });

    expect(result).toBe(app);
    expect(create).toHaveBeenCalledWith(AppModule, undefined);
    expect(app.setGlobalPrefix).not.toHaveBeenCalled();
    expect(app.enableCors).toHaveBeenCalledWith(undefined);
    expect(app.enableShutdownHooks).toHaveBeenCalled();
    // json + urlencoded body parsers only; no security headers by default
    expect(app.use).toHaveBeenCalledTimes(2);
    expect(initOpenapi).toHaveBeenCalledWith(
      app,
      'AppModule',
      'server-api',
      'apps/api',
      undefined,
      undefined,
    );
  });

  it('passes through prefix, cors, title, version, builder and nest options', async () => {
    const corsOptions = { origin: 'https://example.com' };
    const documentBuilder = jest.fn((b) => b);
    const nestOptions = { bufferLogs: true };

    await configureApiApp(
      AppModule,
      {
        project: 'p',
        appRoot: 'r',
        corsOptions,
        globalPrefix: 'api',
        title: 'Title',
        version: '1.0.0',
        documentBuilder,
      },
      nestOptions,
    );

    expect(create).toHaveBeenCalledWith(AppModule, nestOptions);
    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api');
    expect(app.enableCors).toHaveBeenCalledWith(corsOptions);
    expect(initOpenapi).toHaveBeenCalledWith(
      app,
      'Title',
      'p',
      'r',
      '1.0.0',
      documentBuilder,
    );
  });

  it('installs a security headers middleware when enabled', async () => {
    await configureApiApp(AppModule, {
      project: 'p',
      appRoot: 'r',
      enableSecurityHeaders: true,
    });

    expect(app.use).toHaveBeenCalledTimes(3);
    const middleware = app.use.mock.calls[0][0];
    const headers: Record<string, string> = {};
    const res = { setHeader: (k: string, v: string) => (headers[k] = v) };
    const next = jest.fn();

    middleware({}, res, next);

    expect(next).toHaveBeenCalled();
    expect(headers).toMatchObject({
      'X-XSS-Protection': '1; mode=block',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Strict-Transport-Security':
        'max-age=31536000; includeSubDomains; preload',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    });
    expect(headers['Content-Security-Policy']).toContain("default-src 'self'");
  });
});
