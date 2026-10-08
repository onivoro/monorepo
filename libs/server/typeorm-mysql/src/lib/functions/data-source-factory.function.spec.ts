import { DataSource } from 'typeorm';
import { dataSourceFactory } from './data-source-factory.function';

describe('dataSourceFactory (mysql)', () => {
  it('creates an uninitialized DataSource from the generated config', () => {
    class E {}
    const dataSource = dataSourceFactory(
      'reports',
      { database: 'db', host: 'h', port: '3306', username: 'u', password: 'p' },
      [E],
    );

    expect(dataSource).toBeInstanceOf(DataSource);
    expect(dataSource.isInitialized).toBe(false);
    expect(dataSource.options).toEqual(
      expect.objectContaining({
        name: 'reports',
        type: 'mysql',
        database: 'db',
        host: 'h',
        username: 'u',
        password: 'p',
        entities: [E],
      }),
    );
  });
});
