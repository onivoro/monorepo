import { applyDecorators } from "@nestjs/common";
import { Column, ColumnOptions } from "typeorm";
import { ApiPropertyOptional } from '@nestjs/swagger';
import { getApiTypeFromColumn } from "../functions/get-api-type-from-column.function";

export const NullableTableColumn = (options?: Pick<ColumnOptions, 'type'>) => {
    const apiType = getApiTypeFromColumn(options?.type);
    return applyDecorators(Column({ type: options?.type, nullable: true }), ApiPropertyOptional({type: apiType}));
};
