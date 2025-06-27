import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { IDataSourceOptions } from '../types/data-source-options.interface';

export function dataSourceConfigFactory(
  name: string,
  options: IDataSourceOptions,
  entities: any[]
): PostgresConnectionOptions {

  const {
    ca, database, host, password, port, username, synchronize = false, logging = false, schema,
  } = options;

  const config: PostgresConnectionOptions = {
    name,
    type: 'postgres',
    host,
    port: port as any,
    username,
    password,
    ssl: ca ? { ca } : undefined,
    database,
    synchronize,
    logging,
    entities,
    schema,
    subscribers: [],
    migrations: [],
    namingStrategy: new SnakeNamingStrategy(),
  };

  return config;
}
