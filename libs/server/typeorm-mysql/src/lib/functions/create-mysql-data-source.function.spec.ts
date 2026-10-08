import { DataSource } from 'typeorm';
import { createMysqlDataSource } from './create-mysql-data-source.function';

const options = {
  database: 'db',
  host: 'h',
  port: '3306',
  username: 'u',
  password: 'p',
};

describe('createMysqlDataSource', () => {
  it('defaults the name to "default" and does not connect', () => {
    const dataSource = createMysqlDataSource({ options, entities: [] });

    expect(dataSource).toBeInstanceOf(DataSource);
    expect(dataSource.isInitialized).toBe(false);
    expect(dataSource.options).toEqual(
      expect.objectContaining({
        name: 'default',
        type: 'mysql',
        database: 'db',
        migrations: [],
      }),
    );
  });

  it('applies name, migrations and extras (extras win)', () => {
    class E {}
    const dataSource = createMysqlDataSource({
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
