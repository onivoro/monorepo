jest.mock('../functions/load-dot-env-for-key.function', () => ({
  loadDotEnvForKey: jest.fn(),
}));

import { loadDotEnvForKey } from '../functions/load-dot-env-for-key.function';
import { EnvironmentClass } from './environment-class.decorator';

describe('EnvironmentClass', () => {
  const keys = ['SC_TEST_HOST', 'SC_TEST_PORT'];
  let warn: jest.SpyInstance;

  beforeEach(() => {
    (loadDotEnvForKey as jest.Mock).mockClear();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    keys.forEach((k) => delete process.env[k]);
    warn.mockRestore();
  });

  it('populates declared properties from process.env', () => {
    process.env['SC_TEST_HOST'] = 'db.local';
    process.env['SC_TEST_PORT'] = '5432';

    @EnvironmentClass()
    class Env {
      SC_TEST_HOST: string | undefined = undefined;
      SC_TEST_PORT: string | undefined = undefined;
    }

    const env = new Env();

    expect(env).toEqual({ SC_TEST_HOST: 'db.local', SC_TEST_PORT: '5432' });
    expect(warn).not.toHaveBeenCalled();
  });

  it('loads the env file named by the key before reading values', () => {
    @EnvironmentClass('ENV_FILE')
    class Env {
      SC_TEST_HOST: string | undefined = undefined;
    }

    new Env();

    expect(loadDotEnvForKey).toHaveBeenCalledWith('ENV_FILE');
  });

  it('warns about properties that have neither an env value nor a default', () => {
    process.env['SC_TEST_HOST'] = 'h';

    @EnvironmentClass()
    class Env {
      SC_TEST_HOST: string | undefined = undefined;
      SC_TEST_PORT: string | undefined = undefined;
    }

    const env = new Env();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('Env MISSING ENV VAR SC_TEST_PORT');
    expect(env.SC_TEST_PORT).toBeUndefined();
  });

  it('keeps an initializer default when the env var is unset', () => {
    process.env['SC_TEST_HOST'] = 'db.local';

    @EnvironmentClass()
    class Env {
      SC_TEST_HOST = 'localhost';
      SC_TEST_PORT = '5432';
    }

    const env = new Env();

    expect(env).toEqual({ SC_TEST_HOST: 'db.local', SC_TEST_PORT: '5432' });
    expect(warn).not.toHaveBeenCalled();
  });
});
