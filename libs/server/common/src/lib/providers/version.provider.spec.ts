jest.mock('../functions/parse-package-json.function', () => ({
  parsePackageJson: jest.fn(),
}));

import { versionProviderToken } from '../constants/version-provider-token.constant';
import { parsePackageJson } from '../functions/parse-package-json.function';
import { versionProvider } from './version.provider';

describe('versionProvider', () => {
  it('provides the version token', () => {
    expect(versionProvider.provide).toBe(versionProviderToken);
  });

  it('resolves the version from package.json', async () => {
    (parsePackageJson as jest.Mock).mockResolvedValueOnce({ version: '3.4.5' });
    await expect(versionProvider.useFactory()).resolves.toBe('3.4.5');
  });

  it('falls back to 0.0.0 when package.json cannot be read', async () => {
    (parsePackageJson as jest.Mock).mockRejectedValueOnce(new Error('ENOENT'));
    await expect(versionProvider.useFactory()).resolves.toBe('0.0.0');
  });
});
