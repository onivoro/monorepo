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

  console.info({ detail: `${ca ? '' : 'NOT '}using SSL certificate for database connection ${username}@${host}:${port}/${database}`, ca });

  const config: PostgresConnectionOptions = {
    name,
    type: 'postgres',
    host,
    port: port as any,
    username,
    password,
    ssl: ca ? { ca } : undefined,
    database,
    synchronize: synchronize && (process.env.NODE_ENV !== 'production'),
    logging,
    entities,
    schema,
    subscribers: [],
    migrations: [],
    namingStrategy: new SnakeNamingStrategy(),
  };

  return config;
}
