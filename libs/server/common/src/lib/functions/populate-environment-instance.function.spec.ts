import { EnvOptional, EnvRequired } from '../decorators/env-member.decorator';
import { populateEnvironmentInstance } from './populate-environment-instance.function';

describe('populateEnvironmentInstance', () => {
  class Config {
    HOST = 'localhost';
    PORT?: string;
    NAME?: string;
  }

  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => warn.mockRestore());

  it('uses resolved values, keeps defaults for undefined ones, and returns a plain object', () => {
    const resolved: Record<string, string> = { PORT: '5432', NAME: 'app' };

    const config = populateEnvironmentInstance(
      Config,
      (member) => resolved[member],
    );

    expect(config).toEqual({ HOST: 'localhost', PORT: '5432', NAME: 'app' });
    expect(config).not.toBeInstanceOf(Config);
  });

  it('lets an empty string override a default', () => {
    const config = populateEnvironmentInstance(Config, (member) =>
      member === 'HOST' ? '' : 'x',
    );

    expect(config.HOST).toBe('');
  });

  it('warns about members with neither a resolved value nor a default, naming the class', () => {
    populateEnvironmentInstance(Config, () => undefined);

    expect(warn.mock.calls).toEqual([
      ['Config MISSING ENV VAR PORT'],
      ['Config MISSING ENV VAR NAME'],
    ]);
  });

  it('uses the source and describe options in the warning', () => {
    populateEnvironmentInstance(
      Config,
      (member) => (member === 'PORT' ? '1' : undefined),
      {
        source: 'SECRET',
        describe: (member) => `${member} (key ${member.toLowerCase()})`,
      },
    );

    expect(warn.mock.calls).toEqual([
      ['Config MISSING SECRET NAME (key name)'],
    ]);
  });

  describe('with @EnvRequired members', () => {
    class Required {
      @EnvRequired() DATABASE_URL!: string;
      @EnvRequired() API_KEY!: string;
      @EnvRequired() REGION = 'us-east-1';
      SENTRY_DSN?: string;
    }

    it('throws one error listing every required member that ends up empty, without warning about them', () => {
      expect(() =>
        populateEnvironmentInstance(Required, (member) =>
          member === 'REGION' ? '' : undefined,
        ),
      ).toThrow(
        'Required is missing required values: DATABASE_URL, API_KEY, REGION',
      );
      expect(warn.mock.calls).toEqual([
        ['Required MISSING ENV VAR SENTRY_DSN'],
      ]);
    });

    it('accepts a required member satisfied by its default', () => {
      const config = populateEnvironmentInstance(Required, (member) =>
        ['DATABASE_URL', 'API_KEY'].includes(member) ? 'x' : undefined,
      );

      expect(config).toEqual({
        DATABASE_URL: 'x',
        API_KEY: 'x',
        REGION: 'us-east-1',
        SENTRY_DSN: undefined,
      });
    });

    it('describes members in the error', () => {
      expect(() =>
        populateEnvironmentInstance(Required, () => 'x', {
          describe: (member) => `${member}!`,
        }),
      ).not.toThrow();

      expect(() =>
        populateEnvironmentInstance(Required, () => undefined, {
          describe: (member) => `${member}!`,
        }),
      ).toThrow('Required is missing required values: DATABASE_URL!, API_KEY!');
    });
  });

  describe('with decorated members that do not exist at runtime', () => {
    // Simulates useDefineForClassFields: false, where `X?: string;` emits nothing.
    class Legacy {
      REGION = 'us-east-1';
    }
    EnvRequired()(Legacy.prototype, 'DATABASE_URL');
    EnvOptional()(Legacy.prototype, 'SENTRY_DSN');

    it('resolves them anyway', () => {
      const values: Record<string, string> = {
        DATABASE_URL: 'postgres://db',
        SENTRY_DSN: 'https://sentry',
      };

      expect(
        populateEnvironmentInstance(Legacy, (member) => values[member]),
      ).toEqual({
        REGION: 'us-east-1',
        DATABASE_URL: 'postgres://db',
        SENTRY_DSN: 'https://sentry',
      });
    });

    it('enforces required ones and never warns about optional ones', () => {
      expect(() =>
        populateEnvironmentInstance(Legacy, () => undefined),
      ).toThrow('Legacy is missing required values: DATABASE_URL');
      expect(warn).not.toHaveBeenCalled();
    });
  });

  it('does not warn about an empty @EnvOptional member but still warns about undecorated ones', () => {
    class Config {
      @EnvOptional() SENTRY_DSN?: string;
      OTHER?: string;
    }

    expect(populateEnvironmentInstance(Config, () => undefined)).toEqual({});
    expect(warn.mock.calls).toEqual([['Config MISSING ENV VAR OTHER']]);
  });

  it('treats only undefined, null, and empty strings as missing', () => {
    class Config {
      @EnvRequired() RETRIES = 0;
      @EnvRequired() ENABLED = false;
    }

    expect(populateEnvironmentInstance(Config, () => undefined)).toEqual({
      RETRIES: 0,
      ENABLED: false,
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('populates a provided instance instead of constructing one', () => {
    const construct = jest.fn();

    class Config {
      HOST = 'localhost';
      constructor() {
        construct();
      }
    }

    const instance = new Config();
    construct.mockClear();

    expect(
      populateEnvironmentInstance(Config, () => 'db', { instance }),
    ).toEqual({ HOST: 'db' });
    expect(construct).not.toHaveBeenCalled();
  });
});
