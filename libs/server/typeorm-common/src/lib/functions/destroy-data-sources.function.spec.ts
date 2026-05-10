import { DataSource } from 'typeorm';
import { destroyDataSources } from './destroy-data-sources.function';

type FakeDataSource = { isInitialized: boolean; destroy: jest.Mock };

function fake(isInitialized: boolean, destroyImpl?: () => Promise<void>): FakeDataSource {
  return {
    isInitialized,
    destroy: jest.fn(destroyImpl ?? (async () => { /* noop */ })),
  };
}

describe(destroyDataSources.name, () => {
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => { /* silence */ });
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => { /* silence */ });
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('destroys every initialized data source and empties the map', async () => {
    const a = fake(true);
    const b = fake(true);
    const map = new Map<string, DataSource>([
      ['default', a as unknown as DataSource],
      ['analytics', b as unknown as DataSource],
    ]);

    await destroyDataSources(map);

    expect(a.destroy).toHaveBeenCalledTimes(1);
    expect(b.destroy).toHaveBeenCalledTimes(1);
    expect(map.size).toBe(0);
  });

  it('skips destroy on uninitialized data sources but still removes them from the map', async () => {
    const uninitialized = fake(false);
    const map = new Map<string, DataSource>([
      ['default', uninitialized as unknown as DataSource],
    ]);

    await destroyDataSources(map);

    expect(uninitialized.destroy).not.toHaveBeenCalled();
    expect(map.size).toBe(0);
  });

  it('swallows destroy errors, logs them, and still removes the entry', async () => {
    const boom = fake(true, async () => { throw new Error('pool already closed'); });
    const ok = fake(true);
    const map = new Map<string, DataSource>([
      ['broken', boom as unknown as DataSource],
      ['healthy', ok as unknown as DataSource],
    ]);

    await expect(destroyDataSources(map)).resolves.toBeUndefined();

    expect(boom.destroy).toHaveBeenCalledTimes(1);
    expect(ok.destroy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('pool already closed');
    expect(map.size).toBe(0);
  });

  it('is a no-op for an empty map', async () => {
    const map = new Map<string, DataSource>();

    await destroyDataSources(map);

    expect(map.size).toBe(0);
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
