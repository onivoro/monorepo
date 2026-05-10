import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { MysqlConnectionOptions } from 'typeorm/driver/mysql/MysqlConnectionOptions';
import { IDataSourceOptions } from '../types/data-source-options.interface';

export function dataSourceConfigFactory(
  name: string,
  options: IDataSourceOptions,
  entities: any[]
): MysqlConnectionOptions {

  const {
    ca, database, host, password, port, username, synchronize = false, logging = false
  } = options;

  const config: MysqlConnectionOptions = {
    name,
    type: 'mysql',
    host,
    port: port as any,
    username,
    password,
    ssl: ca ? { ca } : undefined,
    database,
    synchronize: synchronize && (process.env.NODE_ENV !== 'production'),
    logging,
    entities,
    subscribers: [],
    migrations: [],
    namingStrategy: new SnakeNamingStrategy(),
  };

  return config;
}
