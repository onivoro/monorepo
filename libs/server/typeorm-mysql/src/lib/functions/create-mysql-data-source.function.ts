import { DataSource } from 'typeorm';
import { dataSourceConfigFactory } from './data-source-config-factory.function';
import { IDataSourceOptions } from '../types/data-source-options.interface';

export function createMysqlDataSource(params: {
  name?: string;
  options: IDataSourceOptions;
  entities: any[];
  migrations?: string[];
  extras?: Record<string, any>;
}): DataSource {
  return new DataSource({
    ...dataSourceConfigFactory(params.name ?? 'default', params.options, params.entities),
    ...(params.migrations ? { migrations: params.migrations } : {}),
    ...(params.extras ?? {}),
  } as any);
}
