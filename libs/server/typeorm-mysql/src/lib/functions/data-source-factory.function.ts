import { DataSource } from 'typeorm';
import { dataSourceConfigFactory } from './data-source-config-factory.function';
import { IDataSourceOptions } from '../types/data-source-options.interface';

export const dataSourceFactory = (
  name: string,
  options: IDataSourceOptions,
  entities: any[]
) =>
  new DataSource(dataSourceConfigFactory(name, options, entities));
