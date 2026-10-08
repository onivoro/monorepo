import { DataSource } from 'typeorm';
import { dataSourceFactory } from './data-source-factory.function';

describe('dataSourceFactory (postgres)', () => {
  let infoSpy: jest.SpyInstance;

  beforeEach(() => {
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => infoSpy.mockRestore());

  it('creates an uninitialized DataSource from the generated config', () => {
    class E {}
    const dataSource = dataSourceFactory(
      'reports',
      {
        database: 'db',
        host: 'h',
        port: '5432',
        username: 'u',
        password: 'p',
        schema: 'app',
      },
      [E],
    );

    expect(dataSource).toBeInstanceOf(DataSource);
    expect(dataSource.isInitialized).toBe(false);
    expect(dataSource.options).toEqual(
      expect.objectContaining({
        name: 'reports',
        type: 'postgres',
        database: 'db',
        host: 'h',
        username: 'u',
        password: 'p',
        schema: 'app',
        entities: [E],
      }),
    );
  });
});
