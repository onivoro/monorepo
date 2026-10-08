jest.mock('fs', () => ({ existsSync: jest.fn() }));
jest.mock('process', () => ({ loadEnvFile: jest.fn() }));

import { existsSync } from 'fs';
import { loadEnvFile as nodeLoadEnvFile } from 'process';
import { loadDotEnvForKey, loadEnvFile } from './load-dot-env-for-key.function';

const exists = existsSync as jest.Mock;
const nodeLoad = nodeLoadEnvFile as jest.Mock;

describe('loadEnvFile', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    exists.mockReset();
    nodeLoad.mockReset();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('does nothing without a file', () => {
    loadEnvFile();
    expect(exists).not.toHaveBeenCalled();
    expect(nodeLoad).not.toHaveBeenCalled();
  });

  it('loads the file and then .env.local when both exist', () => {
    exists.mockReturnValue(true);

    loadEnvFile('.env.dev');

    expect(nodeLoad.mock.calls).toEqual([['.env.dev'], ['.env.local']]);
  });

  it('warns when the file is missing and still loads .env.local', () => {
    exists.mockImplementation((p: string) => p === '.env.local');

    loadEnvFile('.env.missing');

    expect(warn).toHaveBeenCalledWith(
      'specified environment path ".env.missing" does not exist',
    );
    expect(nodeLoad.mock.calls).toEqual([['.env.local']]);
  });

  it('skips .env.local when it does not exist', () => {
    exists.mockImplementation((p: string) => p === '.env.dev');

    loadEnvFile('.env.dev');

    expect(nodeLoad.mock.calls).toEqual([['.env.dev']]);
  });

  it('skips .env.local when loadEnvLocalFile is false', () => {
    exists.mockReturnValue(true);

    loadEnvFile('.env.dev', false);

    expect(nodeLoad.mock.calls).toEqual([['.env.dev']]);
    expect(exists).not.toHaveBeenCalledWith('.env.local');
  });
});

describe('loadDotEnvForKey', () => {
  const KEY = 'SERVER_COMMON_TEST_ENV_FILE';

  beforeEach(() => {
    exists.mockReset().mockReturnValue(false);
    nodeLoad.mockReset();
  });

  afterEach(() => {
    delete process.env[KEY];
  });

  it('does nothing without a key', () => {
    loadDotEnvForKey();
    expect(exists).not.toHaveBeenCalled();
  });

  it('loads the file path stored in the named env var', () => {
    process.env[KEY] = '.env.from-key';
    exists.mockImplementation((p: string) => p === '.env.from-key');

    loadDotEnvForKey(KEY);

    expect(nodeLoad).toHaveBeenCalledWith('.env.from-key');
  });

  it('does nothing when the named env var is unset', () => {
    loadDotEnvForKey(KEY);
    expect(exists).not.toHaveBeenCalled();
  });
});
