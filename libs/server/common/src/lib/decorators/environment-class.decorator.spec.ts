jest.mock('../functions/load-dot-env-for-key.function', () => ({
  loadDotEnvForKey: jest.fn(),
}));

import { loadDotEnvForKey } from '../functions/load-dot-env-for-key.function';
import { EnvOptional, EnvRequired } from './env-member.decorator';
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

  it('throws when an @EnvRequired member is missing', () => {
    @EnvironmentClass()
    class Env {
      @EnvRequired() SC_TEST_HOST!: string;
      SC_TEST_PORT = '5432';
    }

    expect(() => new Env()).toThrow(
      'Env is missing required values: SC_TEST_HOST',
    );

    process.env['SC_TEST_HOST'] = 'db.local';

    expect(new Env()).toEqual({
      SC_TEST_HOST: 'db.local',
      SC_TEST_PORT: '5432',
    });
  });

  it('lets a defined but empty env var override a non-empty initializer, and warns about the empty result', () => {
    process.env['SC_TEST_HOST'] = '';

    @EnvironmentClass()
    class Env {
      SC_TEST_HOST = 'localhost';
    }

    expect(new Env()).toEqual({ SC_TEST_HOST: '' });
    expect(warn.mock.calls).toEqual([['Env MISSING ENV VAR SC_TEST_HOST']]);
  });

  it('accepts an @EnvRequired member satisfied by its initializer', () => {
    @EnvironmentClass()
    class Env {
      @EnvRequired() SC_TEST_HOST = 'localhost';
    }

    expect(new Env()).toEqual({ SC_TEST_HOST: 'localhost' });
  });

  it('throws when an empty env var clears the initializer of an @EnvRequired member', () => {
    process.env['SC_TEST_HOST'] = '';

    @EnvironmentClass()
    class Env {
      @EnvRequired() SC_TEST_HOST = 'localhost';
    }

    expect(() => new Env()).toThrow(
      'Env is missing required values: SC_TEST_HOST',
    );
  });

  it('populates declared members without initializers', () => {
    process.env['SC_TEST_HOST'] = 'db.local';
    process.env['SC_TEST_PORT'] = '5432';

    @EnvironmentClass()
    class Env {
      @EnvRequired() SC_TEST_HOST!: string;
      @EnvOptional() SC_TEST_PORT?: string;
      SC_TEST_REGION = 'us-east-1';
    }

    expect(new Env()).toEqual({
      SC_TEST_HOST: 'db.local',
      SC_TEST_PORT: '5432',
      SC_TEST_REGION: 'us-east-1',
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('populates a decorated subclass of a decorated parent once, without the parent populating itself', () => {
    process.env['SC_TEST_PORT'] = '5432';

    @EnvironmentClass()
    class Base {
      @EnvRequired() SC_TEST_HOST!: string;
    }

    @EnvironmentClass()
    class Child extends Base {
      SC_TEST_PORT?: string;
    }

    expect(() => new Child()).toThrow(
      'Child is missing required values: SC_TEST_HOST',
    );

    process.env['SC_TEST_HOST'] = 'db.local';

    expect(new Child()).toEqual({
      SC_TEST_HOST: 'db.local',
      SC_TEST_PORT: '5432',
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('still populates an undecorated subclass through the decorated parent', () => {
    process.env['SC_TEST_HOST'] = 'db.local';

    @EnvironmentClass()
    class Base {
      SC_TEST_HOST?: string;
    }

    class Sub extends Base {}

    expect(new Sub()).toEqual({ SC_TEST_HOST: 'db.local' });
  });
});
