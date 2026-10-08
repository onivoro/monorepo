import { DataSource } from 'typeorm';
import { createPostgresDataSource } from './create-postgres-data-source.function';

const options = {
  database: 'db',
  host: 'h',
  port: '5432',
  username: 'u',
  password: 'p',
};

describe('createPostgresDataSource', () => {
  let infoSpy: jest.SpyInstance;

  beforeEach(() => {
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => infoSpy.mockRestore());

  it('defaults the name to "default" and does not connect', () => {
    const dataSource = createPostgresDataSource({ options, entities: [] });

    expect(dataSource).toBeInstanceOf(DataSource);
    expect(dataSource.isInitialized).toBe(false);
    expect(dataSource.options).toEqual(
      expect.objectContaining({
        name: 'default',
        type: 'postgres',
        database: 'db',
        migrations: [],
      }),
    );
  });

  it('applies name, migrations and extras (extras win)', () => {
    class E {}
    const dataSource = createPostgresDataSource({
      name: 'cli',
      options,
      entities: [E],
      migrations: ['dist/migrations/*.js'],
      extras: { logging: true, migrationsTableName: 'mig' },
    });

    expect(dataSource.options).toEqual(
      expect.objectContaining({
        name: 'cli',
        entities: [E],
        migrations: ['dist/migrations/*.js'],
        logging: true,
        migrationsTableName: 'mig',
      }),
    );
  });
});
