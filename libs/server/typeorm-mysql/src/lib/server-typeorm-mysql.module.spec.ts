jest.mock('./functions/data-source-factory.function', () => ({
  dataSourceFactory: jest.fn(),
}));

type TModule = typeof import('./server-typeorm-mysql.module');

function load() {
  let mod!: TModule;
  let factory!: jest.Mock;
  let typeorm!: typeof import('typeorm');
  // a fresh module registry gives each test its own module-level data source cache
  jest.isolateModules(() => {
    mod = require('./server-typeorm-mysql.module');
    factory =
      require('./functions/data-source-factory.function').dataSourceFactory;
    typeorm = require('typeorm');
  });
  factory.mockReset();
  return {
    ServerTypeormMysqlModule: mod.ServerTypeormMysqlModule,
    factory,
    DataSource: typeorm.DataSource,
    EntityManager: typeorm.EntityManager,
  };
}

function fakeDataSource() {
  const ds: any = {
    isInitialized: false,
    manager: { marker: 'manager' },
    initialize: jest.fn(async () => {
      ds.isInitialized = true;
      return ds;
    }),
    destroy: jest.fn(async () => {
      ds.isInitialized = false;
    }),
  };
  return ds;
}

const options = {
  database: 'db',
  host: 'h',
  port: '3306',
  username: 'u',
  password: 'p',
};

describe('ServerTypeormMysqlModule', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => logSpy.mockRestore());

  it('builds a dynamic module that provides and exports DataSource, EntityManager and the injectables', () => {
    const { ServerTypeormMysqlModule, DataSource, EntityManager } = load();
    class SomeRepo {}

    const dynamicModule = ServerTypeormMysqlModule.configure(
      [SomeRepo],
      [],
      options,
    );

    expect(dynamicModule.module).toBe(ServerTypeormMysqlModule);
    expect(dynamicModule.exports).toBe(dynamicModule.providers);
    const provided = (dynamicModule.providers as any[]).map(
      (p) => p.provide ?? p,
    );
    expect(provided).toEqual([DataSource, EntityManager, SomeRepo]);
  });

  it('creates and initializes the data source once per name, then reuses it', async () => {
    const { ServerTypeormMysqlModule, factory } = load();
    class E {}
    const ds = fakeDataSource();
    factory.mockReturnValue(ds);

    const [dataSourceProvider] = ServerTypeormMysqlModule.configure(
      [],
      [E],
      options,
      'primary',
    ).providers as any[];

    const first = await dataSourceProvider.useFactory();
    const second = await dataSourceProvider.useFactory();

    expect(first).toBe(ds);
    expect(second).toBe(ds);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledWith('primary', options, [E]);
    expect(ds.initialize).toHaveBeenCalledTimes(1);
  });

  it('uses "default" as the data source name', async () => {
    const { ServerTypeormMysqlModule, factory } = load();
    factory.mockReturnValue(fakeDataSource());

    const [dataSourceProvider] = ServerTypeormMysqlModule.configure(
      [],
      [],
      options,
    ).providers as any[];
    await dataSourceProvider.useFactory();

    expect(factory).toHaveBeenCalledWith('default', options, []);
  });

  it('propagates initialization failures without caching the data source', async () => {
    const { ServerTypeormMysqlModule, factory } = load();
    const broken = fakeDataSource();
    broken.initialize.mockRejectedValue(new Error('ECONNREFUSED'));
    const healthy = fakeDataSource();
    factory.mockReturnValueOnce(broken).mockReturnValueOnce(healthy);

    const [dataSourceProvider] = ServerTypeormMysqlModule.configure(
      [],
      [],
      options,
      'flaky',
    ).providers as any[];

    await expect(dataSourceProvider.useFactory()).rejects.toThrow(
      'ECONNREFUSED',
    );
    await expect(dataSourceProvider.useFactory()).resolves.toBe(healthy);
  });

  it('provides the EntityManager from the data source', () => {
    const { ServerTypeormMysqlModule, DataSource } = load();
    const [, entityManagerProvider] = ServerTypeormMysqlModule.configure(
      [],
      [],
      options,
    ).providers as any[];

    expect(entityManagerProvider.inject).toEqual([DataSource]);
    expect(entityManagerProvider.useFactory({ manager: 'mgr' })).toBe('mgr');
    expect(entityManagerProvider.useFactory(undefined)).toBeUndefined();
  });

  it('destroys initialized data sources on application shutdown', async () => {
    const { ServerTypeormMysqlModule, factory } = load();
    const ds = fakeDataSource();
    factory.mockReturnValue(ds);
    const [dataSourceProvider] = ServerTypeormMysqlModule.configure(
      [],
      [],
      options,
      'shutdown',
    ).providers as any[];
    await dataSourceProvider.useFactory();

    await new ServerTypeormMysqlModule().onApplicationShutdown();

    expect(ds.destroy).toHaveBeenCalledTimes(1);

    // the cache was cleared, so the next request builds a new data source
    const next = fakeDataSource();
    factory.mockReturnValue(next);
    await expect(dataSourceProvider.useFactory()).resolves.toBe(next);
  });
});
