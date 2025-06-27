import { DynamicModule, Module, OnApplicationShutdown } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { dataSourceFactory } from './functions/data-source-factory.function';
import { IDataSourceOptions } from './types/data-source-options.interface';

const dataSourceMap = new Map<string, DataSource>();

@Module({})
export class ServerTypeormMysqlModule implements OnApplicationShutdown {

  async onApplicationShutdown(): Promise<void> {
    for (let dataSourceKey in dataSourceMap.keys()) {
      try {
        const dataSource = dataSourceMap.get(dataSourceKey);
        if (dataSource && dataSource.isInitialized) {
          console.log(`destroying connection ${dataSourceKey}`);
          await dataSource.destroy();
        }
      } catch (e: any) {
        console.error(e?.message || e);
      }
    }
  }

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
          return dataSource?.manager as any;
        },
        inject: [DataSource]
      },
      ...injectables,
    ];
    return {
      module: ServerTypeormMysqlModule,
      exports: providers,
      providers,
    };
  }
}
