import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { QueryPagedParams } from './query-paged-params.decorator';
import { QuerySortParams } from './query-sort-params.decorator';

function getFactory(decorator: (...args: any[]) => ParameterDecorator) {
  class Target {
    handler(@decorator() _value: unknown) {
      return _value;
    }
  }
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, Target, 'handler');
  return args[Object.keys(args)[0]].factory as (
    data: unknown,
    ctx: ExecutionContext,
  ) => any;
}

function ctx(query: unknown) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ query }) }),
  } as unknown as ExecutionContext;
}

describe('QueryPagedParams', () => {
  const factory = getFactory(QueryPagedParams);

  it('parses camelCase query values as numbers', () => {
    expect(factory(undefined, ctx({ pageSize: '25', pagingKey: '3' }))).toEqual(
      { pageSize: 25, pagingKey: 3 },
    );
  });

  it('accepts lowercase aliases', () => {
    expect(factory(undefined, ctx({ pagesize: '10', pagingkey: '2' }))).toEqual(
      { pageSize: 10, pagingKey: 2 },
    );
  });

  it('prefers camelCase over lowercase', () => {
    expect(
      factory(undefined, ctx({ pageSize: '5', pagesize: '10' })).pageSize,
    ).toBe(5);
  });

  it('returns undefined for missing, zero, or non-numeric values', () => {
    expect(
      factory(undefined, ctx({ pageSize: 'abc', pagingKey: '0' })),
    ).toEqual({
      pageSize: undefined,
      pagingKey: undefined,
    });
    expect(factory(undefined, ctx(undefined))).toEqual({
      pageSize: undefined,
      pagingKey: undefined,
    });
  });
});

describe('QuerySortParams', () => {
  const factory = getFactory(QuerySortParams);

  it('reads camelCase query values', () => {
    expect(
      factory(undefined, ctx({ sortKey: 'name', sortDirection: 'desc' })),
    ).toEqual({
      sortKey: 'name',
      sortDirection: 'desc',
    });
  });

  it('accepts lowercase aliases', () => {
    expect(
      factory(undefined, ctx({ sortkey: 'age', sortdirection: 'asc' })),
    ).toEqual({
      sortKey: 'age',
      sortDirection: 'asc',
    });
  });

  it('returns undefined for missing or empty values', () => {
    expect(factory(undefined, ctx({ sortKey: '' }))).toEqual({
      sortKey: undefined,
      sortDirection: undefined,
    });
    expect(factory(undefined, ctx(undefined))).toEqual({
      sortKey: undefined,
      sortDirection: undefined,
    });
  });
});
