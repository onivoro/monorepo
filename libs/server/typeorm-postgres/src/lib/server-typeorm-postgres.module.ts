import { DynamicModule, Module } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { dataSourceFactory } from './functions/data-source-factory.function';
import { IDataSourceOptions } from './types/data-source-options.interface';

const dataSourceMap = new Map();

@Module({})
export class ServerTypeormPostgresModule {
  static configure(
    injectables: any[],
    entities: any[],
    options: IDataSourceOptions,
    name = 'default'
  ): DynamicModule {
    const providers = [
      {
        provide: DataSource,
        useFactory: async () => {
          const cachedDataSource = dataSourceMap.get(name);
          if (!cachedDataSource) {
            const dataSource: DataSource = dataSourceFactory(name, options, entities);
            await dataSource.initialize();
            dataSourceMap.set(name, dataSource);
          }
          return dataSourceMap.get(name);
        },
      },
      {
        provide: EntityManager,
        useFactory: (dataSource: DataSource) => {
          return dataSource.manager;
        },
        inject: [DataSource]
      },
      ...injectables,
    ];
    return {
      module: ServerTypeormPostgresModule,
      exports: providers,
      providers,
    };
  }
}
