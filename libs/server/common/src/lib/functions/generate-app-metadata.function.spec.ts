import { generateAppMetadata } from './generate-app-metadata.function';

describe('generateAppMetadata', () => {
  it('derives platform, app and paths from the project name and root', () => {
    expect(generateAppMetadata('server-api', 'apps/server/api')).toEqual({
      platform: 'server',
      app: 'api',
      assetPath: 'apps/server/api/src/assets',
      packageJsonPath: 'apps/server/api/package.json',
      swaggerJsonPath: 'api-dox/server-api.json',
    });
  });

  it('only uses the first two dash-separated segments for platform and app', () => {
    const { platform, app, swaggerJsonPath } = generateAppMetadata(
      'server-my-app',
      'x',
    );
    expect(platform).toBe('server');
    expect(app).toBe('my');
    expect(swaggerJsonPath).toBe('api-dox/server-my-app.json');
  });

  it('leaves app undefined when the project has no dash', () => {
    expect(generateAppMetadata('solo', 'r').app).toBeUndefined();
  });
});
