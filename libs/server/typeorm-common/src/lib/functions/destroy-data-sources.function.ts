import { DataSource } from 'typeorm';

export async function destroyDataSources(dataSourceMap: Map<string, DataSource>): Promise<void> {
  for (const [name, dataSource] of dataSourceMap) {
    try {
      if (dataSource?.isInitialized) {
        console.log(`destroying connection ${name}`);
        await dataSource.destroy();
      }
    } catch (e: any) {
      console.error(e?.message ?? e);
    } finally {
      dataSourceMap.delete(name);
    }
  }
}
