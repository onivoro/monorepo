import { PATH_METADATA } from '@nestjs/common/constants';
import { ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { DECORATORS } from '@nestjs/swagger/dist/constants';
import { PagedResponseDto } from '../dtos/paged-response.dto';
import { ApiBodyUnspecified } from './api-body-unspecified.decorator';
import { ApiQueryPagedParams } from './api-query-paged-params.decorator';
import { ApiQuerySortParams } from './api-query-sort-params.decorator';
import { ApiResponsePaged } from './api-response-paged.decorator';
import { ApiResponseUnspecifiedArray } from './api-response-unspecified-array.decorator';
import { ApiResponseUnspecified } from './api-response-unspecified.decorator';
import { DefaultApiController } from './default-api-controller.decorator';

class ItemDto {
  @ApiProperty() id!: string;
}

class Target {
  @ApiBodyUnspecified()
  body() {}

  @ApiQueryPagedParams()
  paged() {}

  @ApiQuerySortParams()
  sorted() {}

  @ApiResponseUnspecified()
  unspecified() {}

  @ApiResponseUnspecifiedArray()
  unspecifiedArray() {}

  @ApiResponsePaged(ItemDto)
  pagedResponse() {}
}

const meta = (key: string, method: keyof Target) =>
  Reflect.getMetadata(key, Target.prototype[method]);
const firstResponse = (method: keyof Target) =>
  Object.values(meta(DECORATORS.API_RESPONSE, method))[0] as any;

describe('swagger decorators', () => {
  it('ApiBodyUnspecified declares an empty object body', () => {
    const [param] = meta(DECORATORS.API_PARAMETERS, 'body');
    expect(param).toMatchObject({
      in: 'body',
      schema: { type: 'object', properties: {} },
    });
  });

  it('ApiQueryPagedParams declares optional pagingKey and pageSize', () => {
    const params = meta(DECORATORS.API_PARAMETERS, 'paged');
    expect(params.map((p: any) => [p.name, p.in, p.required])).toEqual(
      expect.arrayContaining([
        ['pagingKey', 'query', false],
        ['pageSize', 'query', false],
      ]),
    );
  });

  it('ApiQuerySortParams declares optional sortKey and an asc/desc sortDirection', () => {
    const params = meta(DECORATORS.API_PARAMETERS, 'sorted');
    const sortKey = params.find((p: any) => p.name === 'sortKey');
    const sortDirection = params.find((p: any) => p.name === 'sortDirection');
    expect(sortKey).toMatchObject({ in: 'query', required: false });
    expect(sortDirection).toMatchObject({ in: 'query', required: false });
    expect(JSON.stringify(sortDirection)).toContain('"asc","desc"');
  });

  it('ApiResponseUnspecified declares an empty object response', () => {
    expect(firstResponse('unspecified').schema).toEqual({
      type: 'object',
      properties: {},
    });
  });

  it('ApiResponseUnspecifiedArray declares an array of empty objects', () => {
    expect(firstResponse('unspecifiedArray').schema).toEqual({
      type: 'array',
      items: { type: 'object', properties: {} },
    });
  });

  it('ApiResponsePaged composes PagedResponseDto with a typed data array', () => {
    expect(meta(DECORATORS.API_EXTRA_MODELS, 'pagedResponse')).toEqual(
      expect.arrayContaining([PagedResponseDto, ItemDto]),
    );
    expect(firstResponse('pagedResponse').schema).toEqual({
      allOf: [
        { $ref: getSchemaPath(PagedResponseDto) },
        {
          properties: {
            data: { type: 'array', items: { $ref: getSchemaPath(ItemDto) } },
          },
          required: ['data'],
        },
      ],
    });
  });

  it('DefaultApiController sets the route path and the "Default" tag', () => {
    @DefaultApiController('things')
    class ThingsController {}

    expect(Reflect.getMetadata(PATH_METADATA, ThingsController)).toBe('things');
    expect(Reflect.getMetadata(DECORATORS.API_TAGS, ThingsController)).toEqual([
      'Default',
    ]);
  });
});
