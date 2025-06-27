import { ColumnOptions } from "typeorm";

export function getApiTypeFromColumn(columnType: ColumnOptions['type']) {
    if(!columnType) {
        return 'string';
    }

    switch (columnType) {
        case 'boolean':
            return columnType;
        default:
            return 'string';
    }
}