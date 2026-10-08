jest.mock('fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFile } from 'fs/promises';
import { resolve } from 'path';
import { initOpenapi } from './init-openapi.function';

describe('initOpenapi', () => {
  const app = {} as INestApplication;
  const document = { paths: { '/b': {}, '/a': {} }, openapi: '3.0.0' } as any;
  const originalNodeEnv = process.env.NODE_ENV;
  let createDocument: jest.SpyInstance;
  let setup: jest.SpyInstance;
  let log: jest.SpyInstance;

  beforeEach(() => {
    (writeFile as jest.Mock).mockClear();
    createDocument = jest
      .spyOn(SwaggerModule, 'createDocument')
      .mockReturnValue(document);
    setup = jest
      .spyOn(SwaggerModule, 'setup')
      .mockImplementation(() => undefined);
    log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  it('builds the document, writes sorted JSON outside production, and mounts /dox', async () => {
    process.env.NODE_ENV = 'development';

    const path = await initOpenapi(
      app,
      'My API',
      'server-api',
      'apps/server/api',
    );

    expect(path).toBe('api-dox/server-api.json');
    const [, config] = createDocument.mock.calls[0];
    expect(config.info).toMatchObject({
      title: 'My API',
      description: '',
      version: '0.0.0',
    });
    expect(writeFile).toHaveBeenCalledWith(
      resolve('api-dox/server-api.json'),
      JSON.stringify(
        { openapi: '3.0.0', paths: { '/a': {}, '/b': {} } },
        null,
        2,
      ),
    );
    expect(setup).toHaveBeenCalledWith('dox', app, document);
  });

  it('does not write the JSON file in production', async () => {
    process.env.NODE_ENV = 'production';

    await initOpenapi(app, 'My API', 'server-api', 'apps/server/api');

    expect(writeFile).not.toHaveBeenCalled();
    expect(setup).toHaveBeenCalledWith('dox', app, document);
  });

  it('applies the version and the custom document builder', async () => {
    process.env.NODE_ENV = 'production';
    const customise = jest.fn((builder: DocumentBuilder) =>
      builder.addBearerAuth(),
    );

    await initOpenapi(app, 'T', 'server-api', 'root', '2.1.0', customise);

    expect(customise).toHaveBeenCalledWith(expect.any(DocumentBuilder));
    const [, config] = createDocument.mock.calls[0];
    expect(config.info.version).toBe('2.1.0');
    expect(config.components.securitySchemes).toHaveProperty('bearer');
  });
});
