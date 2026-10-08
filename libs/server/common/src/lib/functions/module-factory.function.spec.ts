import { moduleFactory } from './module-factory.function';

describe('moduleFactory', () => {
  class ImportedModule {}
  class Provider {}
  class Controller {}
  class DynamicTarget {}

  it('exports both imports and providers', () => {
    expect(
      moduleFactory({ imports: [ImportedModule], providers: [Provider] }),
    ).toEqual({
      imports: [ImportedModule],
      providers: [Provider],
      exports: [ImportedModule, Provider],
    });
  });

  it('handles missing imports and providers', () => {
    expect(moduleFactory({})).toEqual({
      imports: undefined,
      providers: undefined,
      exports: [],
    });
  });

  it('includes controllers only when there are some', () => {
    expect(moduleFactory({ controllers: [Controller] }).controllers).toEqual([
      Controller,
    ]);
    expect(moduleFactory({ controllers: [] })).not.toHaveProperty(
      'controllers',
    );
  });

  it('adds the module key for dynamic modules', () => {
    const result = moduleFactory({
      module: DynamicTarget,
      providers: [Provider],
      controllers: [Controller],
    });
    expect(result).toEqual({
      module: DynamicTarget,
      imports: undefined,
      providers: [Provider],
      exports: [Provider],
      controllers: [Controller],
    });
  });
});
