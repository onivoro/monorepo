import { Module, OnModuleDestroy } from '@nestjs/common';
import { AppController } from './controllers/app.controller';
import { AppServerDatavoreConfig } from './app-server-datavore-config.class';
import { DataSource } from 'typeorm';
import { TableService } from './services/table.service';
import { TablesController } from './controllers/tables.controller';
import { TableController } from './controllers/table.controller';
import { QueryController } from './controllers/query.controller';

const dbConfig = new AppServerDatavoreConfig();
let dataSource: DataSource | null = null;
@Module({
  imports: [],
  controllers: [
    AppController,
    QueryController,
    TableController,
    TablesController,
  ],
  providers: [
    TableService,
    { provide: AppServerDatavoreConfig, useValue: dbConfig },
    {
      provide: DataSource,
      useFactory: async () => {
        if (!dataSource) {

          const dataSourceConfig = {
            ...dbConfig,
            synchronize: false,
            logging: true,
            ssl: undefined,
            entities: [],
            extra: {
              max: 10,
              min: 1,
              acquireTimeoutMillis: 30000,
              createTimeoutMillis: 30000,
              destroyTimeoutMillis: 10000,
              idleTimeoutMillis: 30000,
              reapIntervalMillis: 1000,
              createRetryIntervalMillis: 100
            }
          };

          console.info(`Creating DataSource with configuration:`);
          console.info(`- Type: ${dataSourceConfig.type}`);
          console.info(`- Host: ${dataSourceConfig.host}`);
          console.info(`- Port: ${dataSourceConfig.port}`);
          console.info(`- Database: ${dataSourceConfig.database}`);
          console.info(`- Username: ${dataSourceConfig.username}`);
          console.info(`- SSL: ${dataSourceConfig.ssl ? 'enabled' : 'disabled'}`);

          try {
            const _dataSource = new DataSource(dataSourceConfig);

            await _dataSource.initialize();

            dataSource = _dataSource;

          } catch (error) {
            console.error({ detail: `failed to initialize data source`, error });

            throw error;
          }
        }

        return dataSource;
      }
    }
  ]
})
export class AppModule implements OnModuleDestroy {
  async onModuleDestroy() {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
      console.info('Database connection closed successfully');
    }
  }
}
