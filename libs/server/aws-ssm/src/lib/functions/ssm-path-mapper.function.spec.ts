import { ssmPathMapper } from './ssm-path-mapper.function';

describe('ssmPathMapper', () => {
  it('joins the prefix and member, normalizing slashes', () => {
    expect(ssmPathMapper('prod/api/')('DATABASE_URL', 'Env')).toBe(
      '/prod/api/DATABASE_URL',
    );
    expect(ssmPathMapper('//prod//api')('DATABASE_URL', 'Env')).toBe(
      '/prod/api/DATABASE_URL',
    );
    expect(ssmPathMapper('')('DATABASE_URL', 'Env')).toBe('/DATABASE_URL');
  });

  it('converts members to kebab case', () => {
    const mapper = ssmPathMapper('/prod', { case: 'kebab' });

    expect(mapper('DATABASE_URL', 'Env')).toBe('/prod/database-url');
    expect(mapper('databaseUrl', 'Env')).toBe('/prod/database-url');
  });

  it('converts members to lower case', () => {
    expect(
      ssmPathMapper('/prod', { case: 'lower' })('DATABASE_URL', 'Env'),
    ).toBe('/prod/database_url');
  });

  it('evaluates a prefix function on every call', () => {
    const mapper = ssmPathMapper(() => `/${process.env['SSM_TEST_STAGE']}`);

    process.env['SSM_TEST_STAGE'] = 'dev';
    expect(mapper('A', 'Env')).toBe('/dev/A');

    process.env['SSM_TEST_STAGE'] = 'prod';
    expect(mapper('A', 'Env')).toBe('/prod/A');

    delete process.env['SSM_TEST_STAGE'];
  });

  it('rejects paths with characters SSM does not allow', () => {
    expect(() => ssmPathMapper('/prod api')('A', 'Env')).toThrow(
      'invalid SSM parameter path "/prod api/A" for A',
    );
  });
});
