import { applyDecorators } from "@nestjs/common";
import { Column, ColumnOptions } from "typeorm";
import { ApiProperty } from '@nestjs/swagger';
import { getApiTypeFromColumn } from "../functions/get-api-type-from-column.function";

export const PrimaryTableColumn = (options?: Pick<ColumnOptions, 'type'>) => {
    const apiType = getApiTypeFromColumn(options?.type);
    return applyDecorators(Column({ type: options?.type, nullable: false }), ApiProperty({type: apiType}));
};
