jest.mock('@onivoro/server-common', () => ({
  ...jest.requireActual('@onivoro/server-common'),
  loadDotEnvForKey: jest.fn(),
}));

import { GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';
import { loadDotEnvForKey } from '@onivoro/server-common';
import { EnvOptional, EnvRequired } from '../../index';
import { SSMEnvironmentClass } from '../decorators/ssm-environment-class.decorator';
import { loadSSMEnvironment } from './load-ssm-environment.function';

type Params = Record<string, string>;

function mockClient(params: Params) {
  const send = jest.fn(async (command: GetParametersCommand) => {
    const names = command.input.Names ?? [];
    return {
      Parameters: names
        .filter((name) => name in params)
        .map((Name) => ({ Name, Value: params[Name] })),
      InvalidParameters: names.filter((name) => !(name in params)),
    };
  });

  return { client: { send } as unknown as SSMClient, send };
}

describe('loadSSMEnvironment', () => {
  const envKeys = ['SSM_TEST_HOST', 'SSM_TEST_PORT', 'SSM_TEST_STAGE'];
  let warn: jest.SpyInstance;

  beforeEach(() => {
    (loadDotEnvForKey as jest.Mock).mockReset();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    envKeys.forEach((key) => delete process.env[key]);
    warn.mockRestore();
  });

  it('fetches mapped keys and returns a plain object', async () => {
    const mapper = jest.fn((member: string) => `/app/${member}`);

    @SSMEnvironmentClass(mapper)
    class Env {
      SSM_TEST_HOST?: string;
      SSM_TEST_PORT?: string;
    }

    const { client, send } = mockClient({
      '/app/SSM_TEST_HOST': 'db.local',
      '/app/SSM_TEST_PORT': '5432',
    });

    const env = await loadSSMEnvironment(Env, { client });

    expect(env).toEqual({ SSM_TEST_HOST: 'db.local', SSM_TEST_PORT: '5432' });
    expect(env).not.toBeInstanceOf(Env);
    expect(mapper.mock.calls).toEqual([
      ['SSM_TEST_HOST', 'Env'],
      ['SSM_TEST_PORT', 'Env'],
    ]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].input).toEqual({
      Names: ['/app/SSM_TEST_HOST', '/app/SSM_TEST_PORT'],
      WithDecryption: true,
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('prefers process.env, then SSM, then the initializer, and skips fetching env-provided members', async () => {
    process.env['SSM_TEST_HOST'] = 'from-env';

    @SSMEnvironmentClass((member) => `/app/${member}`)
    class Env {
      SSM_TEST_HOST = 'default-host';
      SSM_TEST_PORT = 'default-port';
      SSM_TEST_STAGE = 'default-stage';
    }

    const { client, send } = mockClient({
      '/app/SSM_TEST_HOST': 'from-ssm',
      '/app/SSM_TEST_PORT': 'from-ssm',
    });

    const env = await loadSSMEnvironment(Env, { client });

    expect(env).toEqual({
      SSM_TEST_HOST: 'from-env',
      SSM_TEST_PORT: 'from-ssm',
      SSM_TEST_STAGE: 'default-stage',
    });
    expect(send.mock.calls[0][0].input.Names).toEqual([
      '/app/SSM_TEST_PORT',
      '/app/SSM_TEST_STAGE',
    ]);
  });

  it('does not call SSM when every member is in process.env', async () => {
    process.env['SSM_TEST_HOST'] = 'h';

    @SSMEnvironmentClass((member) => `/app/${member}`)
    class Env {
      SSM_TEST_HOST?: string;
    }

    const { client, send } = mockClient({});

    await expect(loadSSMEnvironment(Env, { client })).resolves.toEqual({
      SSM_TEST_HOST: 'h',
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('fetches a key shared by several members once', async () => {
    @SSMEnvironmentClass(() => '/app/shared')
    class Env {
      SSM_TEST_HOST?: string;
      SSM_TEST_PORT?: string;
    }

    const { client, send } = mockClient({ '/app/shared': 'v' });

    await expect(loadSSMEnvironment(Env, { client })).resolves.toEqual({
      SSM_TEST_HOST: 'v',
      SSM_TEST_PORT: 'v',
    });
    expect(send.mock.calls[0][0].input.Names).toEqual(['/app/shared']);
  });

  it('requests at most 10 names per GetParameters call', async () => {
    @SSMEnvironmentClass((member) => `/app/${member}`)
    class Env {
      constructor() {
        Array.from(
          { length: 23 },
          (_, i) => ((this as any)[`SSM_CHUNK_${i}`] = 'd'),
        );
      }
    }

    const { client, send } = mockClient({});

    await loadSSMEnvironment(Env, { client });

    expect(
      send.mock.calls.map(([command]) => command.input.Names?.length),
    ).toEqual([10, 10, 3]);
  });

  it('matches versioned and labelled keys by name plus selector', async () => {
    @SSMEnvironmentClass((member) =>
      member === 'SSM_TEST_HOST' ? '/app/host:3' : '/app/host',
    )
    class Env {
      SSM_TEST_HOST?: string;
      SSM_TEST_PORT?: string;
    }

    const send = jest.fn(async () => ({
      Parameters: [
        { Name: '/app/host', Selector: ':3', Value: 'v3' },
        { Name: '/app/host', Value: 'latest' },
      ],
    }));

    const env = await loadSSMEnvironment(Env, {
      client: { send } as unknown as SSMClient,
    });

    expect(env).toEqual({ SSM_TEST_HOST: 'v3', SSM_TEST_PORT: 'latest' });
  });

  it('passes withDecryption through', async () => {
    @SSMEnvironmentClass((member) => `/app/${member}`, {
      withDecryption: false,
    })
    class Env {
      SSM_TEST_HOST?: string;
    }

    const { client, send } = mockClient({ '/app/SSM_TEST_HOST': 'h' });

    await loadSSMEnvironment(Env, { client });

    expect(send.mock.calls[0][0].input.WithDecryption).toBe(false);
  });

  it('warns about members with no env value, SSM value, or default', async () => {
    @SSMEnvironmentClass((member) => `/app/${member}`)
    class Env {
      SSM_TEST_HOST?: string;
      SSM_TEST_PORT = '5432';
    }

    const { client } = mockClient({});

    const env = await loadSSMEnvironment(Env, { client });

    expect(env).toEqual({ SSM_TEST_HOST: undefined, SSM_TEST_PORT: '5432' });
    expect(warn.mock.calls).toEqual([
      ['Env SSM PARAMETERS NOT FOUND /app/SSM_TEST_HOST, /app/SSM_TEST_PORT'],
      [
        'Env MISSING ENV VAR OR SSM PARAMETER SSM_TEST_HOST (SSM key /app/SSM_TEST_HOST)',
      ],
    ]);
  });

  it('throws listing every missing @EnvRequired member, warning only about the others', async () => {
    @SSMEnvironmentClass((member) => `/app/${member}`)
    class Env {
      @EnvRequired() SSM_TEST_HOST!: string;
      @EnvRequired() SSM_TEST_PORT!: string;
      SSM_TEST_STAGE?: string;
    }

    const { client } = mockClient({});

    await expect(loadSSMEnvironment(Env, { client })).rejects.toThrow(
      'Env is missing required values: SSM_TEST_HOST (SSM key /app/SSM_TEST_HOST), SSM_TEST_PORT (SSM key /app/SSM_TEST_PORT)',
    );
    expect(warn.mock.calls).toEqual([
      [
        'Env SSM PARAMETERS NOT FOUND /app/SSM_TEST_HOST, /app/SSM_TEST_PORT, /app/SSM_TEST_STAGE',
      ],
      [
        'Env MISSING ENV VAR OR SSM PARAMETER SSM_TEST_STAGE (SSM key /app/SSM_TEST_STAGE)',
      ],
    ]);
  });

  it('accepts @EnvRequired members resolved from SSM', async () => {
    @SSMEnvironmentClass((member) => `/app/${member}`)
    class Env {
      @EnvRequired() SSM_TEST_HOST!: string;
    }

    const { client } = mockClient({ '/app/SSM_TEST_HOST': 'h' });

    await expect(loadSSMEnvironment(Env, { client })).resolves.toEqual({
      SSM_TEST_HOST: 'h',
    });
  });

  it('fetches decorated members that do not exist at runtime', async () => {
    // Simulates useDefineForClassFields: false, where `X?: string;` emits nothing.
    class Raw {}
    EnvRequired()(Raw.prototype, 'SSM_TEST_HOST');
    EnvOptional()(Raw.prototype, 'SSM_TEST_PORT');
    const Env = SSMEnvironmentClass((member) => `/app/${member}`)(Raw);

    const { client, send } = mockClient({
      '/app/SSM_TEST_HOST': 'h',
      '/app/SSM_TEST_PORT': 'p',
    });

    await expect(loadSSMEnvironment(Env, { client })).resolves.toEqual({
      SSM_TEST_HOST: 'h',
      SSM_TEST_PORT: 'p',
    });
    expect(send.mock.calls[0][0].input.Names).toEqual([
      '/app/SSM_TEST_HOST',
      '/app/SSM_TEST_PORT',
    ]);
  });

  it('copies SSM values into process.env when exportToProcessEnv is set', async () => {
    process.env['SSM_TEST_PORT'] = 'from-env';

    @SSMEnvironmentClass((member) => `/app/${member}`, {
      exportToProcessEnv: true,
    })
    class Env {
      SSM_TEST_HOST?: string;
      SSM_TEST_PORT?: string;
      SSM_TEST_STAGE = 'default';
    }

    const { client } = mockClient({
      '/app/SSM_TEST_HOST': 'from-ssm',
      '/app/SSM_TEST_PORT': 'ignored',
    });

    await loadSSMEnvironment(Env, { client });

    expect(process.env['SSM_TEST_HOST']).toBe('from-ssm');
    expect(process.env['SSM_TEST_PORT']).toBe('from-env');
    expect(process.env['SSM_TEST_STAGE']).toBeUndefined();
  });

  it('leaves process.env alone by default', async () => {
    @SSMEnvironmentClass((member) => `/app/${member}`)
    class Env {
      SSM_TEST_HOST?: string;
    }

    const { client } = mockClient({ '/app/SSM_TEST_HOST': 'from-ssm' });

    await loadSSMEnvironment(Env, { client });

    expect(process.env['SSM_TEST_HOST']).toBeUndefined();
  });

  it('loads the env file before calling the mapper, so the mapper can read it', async () => {
    (loadDotEnvForKey as jest.Mock).mockImplementation(
      () => (process.env['SSM_TEST_STAGE'] = 'prod'),
    );

    @SSMEnvironmentClass(
      (member) => `/${process.env['SSM_TEST_STAGE']}/${member}`,
      { envFileKey: 'ENV_FILE' },
    )
    class Env {
      SSM_TEST_HOST?: string;
    }

    const { client, send } = mockClient({});

    await loadSSMEnvironment(Env, { client });

    expect(loadDotEnvForKey).toHaveBeenCalledWith('ENV_FILE');
    expect(send.mock.calls[0][0].input.Names).toEqual(['/prod/SSM_TEST_HOST']);
  });

  it('applies overrides on top of decorator options', async () => {
    @SSMEnvironmentClass((member) => `/app/${member}`, {
      withDecryption: false,
    })
    class Env {
      SSM_TEST_HOST?: string;
    }

    const { client, send } = mockClient({});

    await loadSSMEnvironment(Env, { client, withDecryption: true });

    expect(send.mock.calls[0][0].input.WithDecryption).toBe(true);
  });

  it('throws when the mapper returns an empty key', async () => {
    @SSMEnvironmentClass(() => '  ')
    class Env {
      SSM_TEST_HOST?: string;
    }

    await expect(
      loadSSMEnvironment(Env, { client: mockClient({}).client }),
    ).rejects.toThrow(
      'Env SSM key mapper returned an empty or non-string key for SSM_TEST_HOST',
    );
  });

  it('throws for an undecorated class', async () => {
    class Plain {
      SSM_TEST_HOST?: string;
    }

    await expect(loadSSMEnvironment(Plain)).rejects.toThrow(
      'Plain is not decorated with @SSMEnvironmentClass',
    );
  });

  it('loads a decorated subclass of a decorated parent with the subclass mapper', async () => {
    @SSMEnvironmentClass((member) => `/base/${member}`)
    class Base {
      @EnvRequired() SSM_TEST_HOST!: string;
    }

    @SSMEnvironmentClass((member) => `/child/${member}`)
    class Child extends Base {
      SSM_TEST_PORT?: string;
    }

    const { client } = mockClient({
      '/child/SSM_TEST_HOST': 'h',
      '/child/SSM_TEST_PORT': 'p',
    });

    await expect(loadSSMEnvironment(Child, { client })).resolves.toEqual({
      SSM_TEST_HOST: 'h',
      SSM_TEST_PORT: 'p',
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('throws for an undecorated subclass of a decorated class', async () => {
    @SSMEnvironmentClass((member) => `/app/${member}`)
    class Base {
      SSM_TEST_HOST?: string;
    }

    class Sub extends Base {
      SSM_TEST_PORT?: string;
    }

    await expect(
      loadSSMEnvironment(Sub, { client: mockClient({}).client }),
    ).rejects.toThrow('Sub is not decorated with @SSMEnvironmentClass');
  });

  it('logs parameters SSM reports as not found, even when a default covers them', async () => {
    @SSMEnvironmentClass((member) => `/app/${member}`)
    class Env {
      SSM_TEST_HOST = 'localhost';
    }

    const { client } = mockClient({});

    await expect(loadSSMEnvironment(Env, { client })).resolves.toEqual({
      SSM_TEST_HOST: 'localhost',
    });
    expect(warn.mock.calls).toEqual([
      ['Env SSM PARAMETERS NOT FOUND /app/SSM_TEST_HOST'],
    ]);
  });

  it('matches an ARN with a selector', async () => {
    const arn = 'arn:aws:ssm:us-east-1:123456789012:parameter/app/host';

    @SSMEnvironmentClass(() => `${arn}:3`)
    class Env {
      SSM_TEST_HOST?: string;
    }

    const send = jest.fn(async () => ({
      Parameters: [
        { Name: '/app/host', ARN: arn, Selector: ':3', Value: 'v3' },
      ],
    }));

    await expect(
      loadSSMEnvironment(Env, { client: { send } as unknown as SSMClient }),
    ).resolves.toEqual({
      SSM_TEST_HOST: 'v3',
    });
  });

  it('constructs the class once', async () => {
    const construct = jest.fn();

    @SSMEnvironmentClass((member) => `/app/${member}`)
    class Env {
      SSM_TEST_HOST = 'localhost';
      constructor() {
        construct();
      }
    }

    await loadSSMEnvironment(Env, { client: mockClient({}).client });

    expect(construct).toHaveBeenCalledTimes(1);
  });
});
