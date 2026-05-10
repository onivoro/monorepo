import { ColumnType } from "typeorm";

export type TTableMeta = {
    databasePath: string;
    type: ColumnType;
    propertyPath: string;
    isPrimary: boolean;
    default: unknown;
};
