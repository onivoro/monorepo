jest.mock('./functions/parse-package-json.function', () => ({
  parsePackageJson: jest.fn().mockResolvedValue({ version: '7.8.9' }),
}));
jest.mock('node:os', () => ({
  ...jest.requireActual('node:os'),
  freemem: jest.fn(() => 100),
  totalmem: jest.fn(() => 400),
}));

import { Test } from '@nestjs/testing';
import { PATH_METADATA } from '@nestjs/common/constants';
import { HealthController } from './controllers/health.controller';
import { versionProviderToken } from './constants/version-provider-token.constant';
import { ServerCommonModule } from './server-common.module';

describe('ServerCommonModule', () => {
  it('wires the health controller with the package version', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ServerCommonModule],
    }).compile();

    expect(moduleRef.get(versionProviderToken)).toBe('7.8.9');

    const health = moduleRef.get(HealthController).get();
    expect(health).toMatchObject({ free: 100, total: 400, version: '7.8.9' });
    expect(health).toHaveProperty('percentUtilization');

    await moduleRef.close();
  });

  it('mounts the health controller at /health', () => {
    expect(Reflect.getMetadata(PATH_METADATA, HealthController)).toBe('health');
  });
});
