jest.mock('@onivoro/server-common', () => ({
  ...jest.requireActual('@onivoro/server-common'),
  loadDotEnvForKey: jest.fn(),
}));

import { EnvRequired, loadDotEnvForKey } from '@onivoro/server-common';
import {
  SSM_ENVIRONMENT_METADATA,
  SSMEnvironmentClass,
} from './ssm-environment-class.decorator';

describe('SSMEnvironmentClass', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    (loadDotEnvForKey as jest.Mock).mockClear();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    delete process.env['SSM_TEST_HOST'];
    warn.mockRestore();
  });

  it('stores the original class, mapper, and options as metadata', () => {
    const mapper = (member: string) => `/app/${member}`;
    const options = { envFileKey: 'ENV_FILE', withDecryption: false };

    class Original {
      SSM_TEST_HOST?: string;
    }

    const Decorated = SSMEnvironmentClass(mapper, options)(Original);

    expect(Reflect.getMetadata(SSM_ENVIRONMENT_METADATA, Decorated)).toEqual({
      ctr: Original,
      keyMapper: mapper,
      options,
    });
  });

  it('constructs synchronously from process.env and defaults, warning once per class', () => {
    process.env['SSM_TEST_HOST'] = 'db.local';

    @SSMEnvironmentClass((member) => `/app/${member}`, {
      envFileKey: 'ENV_FILE',
    })
    class Env {
      SSM_TEST_HOST?: string;
      SSM_TEST_PORT = '5432';
    }

    expect(new Env()).toEqual({
      SSM_TEST_HOST: 'db.local',
      SSM_TEST_PORT: '5432',
    });
    new Env();

    expect(loadDotEnvForKey).toHaveBeenCalledWith('ENV_FILE');
    expect(warn.mock.calls).toEqual([
      ['Env was constructed without SSM values; use loadSSMEnvironment(Env)'],
    ]);
  });

  it('enforces @EnvRequired members when constructed synchronously', () => {
    @SSMEnvironmentClass((member) => `/app/${member}`)
    class Env {
      @EnvRequired() SSM_TEST_HOST!: string;
    }

    expect(() => new Env()).toThrow(
      'Env is missing required values: SSM_TEST_HOST',
    );
  });
});
