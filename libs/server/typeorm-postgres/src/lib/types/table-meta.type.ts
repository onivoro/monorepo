import { ColumnType } from "typeorm";
import { ColumnMetadata } from "typeorm/metadata/ColumnMetadata.js";

export type TTableMeta = { databasePath: string, type: ColumnType, propertyPath: string, isPrimary: boolean, default: ColumnMetadata['default'] };