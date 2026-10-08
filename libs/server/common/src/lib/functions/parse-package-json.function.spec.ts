jest.mock('fs/promises', () => {
  const actual = jest.requireActual('fs/promises');
  return { ...actual, readFile: jest.fn(actual.readFile) };
});

import { readFile } from 'fs/promises';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { getPackageVersion } from './get-package-version.function';
import { parsePackageJson } from './parse-package-json.function';

describe('parsePackageJson / getPackageVersion', () => {
  let dir: string;
  let packagePath: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'server-common-pkg-'));
    packagePath = join(dir, 'package.json');
    writeFileSync(
      packagePath,
      JSON.stringify({ name: 'pkg', version: '1.2.3' }),
    );
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('parses the package.json at the given path', async () => {
    await expect(parsePackageJson(packagePath)).resolves.toEqual({
      name: 'pkg',
      version: '1.2.3',
    });
  });

  it('defaults to ./package.json in the working directory', async () => {
    (readFile as jest.Mock).mockResolvedValueOnce('{"version":"9.9.9"}');

    await expect(parsePackageJson()).resolves.toEqual({ version: '9.9.9' });
    expect(readFile).toHaveBeenLastCalledWith('./package.json', 'utf-8');
  });

  it('rejects when the file does not exist', async () => {
    await expect(parsePackageJson(join(dir, 'missing.json'))).rejects.toThrow(
      /ENOENT/,
    );
  });

  it('getPackageVersion returns the version field', async () => {
    await expect(getPackageVersion(packagePath)).resolves.toBe('1.2.3');
  });
});
