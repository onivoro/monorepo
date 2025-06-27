import { ApiProperty } from '@nestjs/swagger';

export class PagedResponseDto<TEntity> {
    data: TEntity[];

    @ApiProperty({ type: 'number' })
    pagingKey: number;

    @ApiProperty({ type: 'number' })
    pageSize: number;

    @ApiProperty({ type: 'number' })
    total: number;
}
