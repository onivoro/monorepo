import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { dataSourceConfigFactory } from './data-source-config-factory.function';

describe(dataSourceConfigFactory.name + ' (mysql)', () => {
  const baseOptions = {
    database: 'mydb',
    host: 'localhost',
    port: '3306',
    username: 'user',
    password: 'pw',
  };

  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('produces a mysql config with sensible defaults', () => {
    const config = dataSourceConfigFactory('default', baseOptions, []);
    expect(config.type).toBe('mysql');
    expect((config as any).name).toBe('default');
    expect(config.synchronize).toBe(false);
    expect(config.logging).toBe(false);
    expect(config.ssl).toBeUndefined();
    expect(config.namingStrategy).toBeInstanceOf(SnakeNamingStrategy);
  });

  it('coerces synchronize to false when NODE_ENV=production', () => {
    process.env.NODE_ENV = 'production';
    const config = dataSourceConfigFactory('x', { ...baseOptions, synchronize: true }, []);
    expect(config.synchronize).toBe(false);
  });

  it('keeps synchronize=true when NODE_ENV is not production', () => {
    process.env.NODE_ENV = 'test';
    const config = dataSourceConfigFactory('x', { ...baseOptions, synchronize: true }, []);
    expect(config.synchronize).toBe(true);
  });

  it('wraps ca into ssl when ca is provided', () => {
    const config = dataSourceConfigFactory('x', { ...baseOptions, ca: 'CA_BYTES' }, []);
    expect(config.ssl).toEqual({ ca: 'CA_BYTES' });
  });

  it('leaves ssl undefined when ca is absent', () => {
    const config = dataSourceConfigFactory('x', baseOptions, []);
    expect(config.ssl).toBeUndefined();
  });

  it('passes entities through', () => {
    class E {}
    const config = dataSourceConfigFactory('x', baseOptions, [E]);
    expect(config.entities).toEqual([E]);
  });
});
