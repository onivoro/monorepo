import { TableColumnOptions } from "typeorm";

export class SqlWriter {

    public static addColumn(table: string, option: TableColumnOptions) {
        const notNullExpression = option.isPrimary ? ` PRIMARY KEY ` : (option.isNullable ? '' : ' NOT NULL ');
        const foreignKey = option.foreignKeyConstraintName ? ` REFERENCES ${option.foreignKeyConstraintName} ` : '';
        const uniqueExpression = option.isUnique ? ' UNIQUE ' : '';
        return `ALTER TABLE "${table}" ADD "${option.name}" ${option.type}${notNullExpression}${uniqueExpression}${SqlWriter.getDefaultValueExpression(option)}${foreignKey}`;
    }

    public static createTable(table: string, options: TableColumnOptions[]) {
        const cols = options.map(option => SqlWriter.addColumn(table, option).replace(`ALTER TABLE "${table}" ADD `, '')).join(',\n');

        return `CREATE TABLE "${table}" (${cols});`;
    }

    public static dropTable(table: string) {
        return `DROP TABLE "${table}";\n`;
    }

    public static addColumns(table: string, options: TableColumnOptions[]) {
        return options.map(option => SqlWriter.addColumn(table, option)).join('; \n');
    }

    public static dropColumn(table: string, option: TableColumnOptions) {
        return `ALTER TABLE "${table}" DROP COLUMN ${option.name}`;
    }

    public static dropColumns(table: string, options: TableColumnOptions[]) {
        return options.map(option => SqlWriter.dropColumn(table, option)).join('; \n');
    }

    public static dropIndex(index: string): string {
        return `DROP INDEX IF EXISTS ${index}`;
    }

    public static createIndex(table: string, column: string, unique: boolean): string {
        const index = SqlWriter.getIndexName(table, column);
        return `CREATE ${unique ? 'UNIQUE' : ''} INDEX IF NOT EXISTS ${index} ON "${table}"(${column})`;
    }

    public static getIndexName(table: string, column: string): string {
        return `${table}_${column}`;
    }

    public static createUniqueIndex(table: string, column: string): string {
        return SqlWriter.createIndex(table, column, true);
    }

    public static getDefaultValueExpression(option: TableColumnOptions) {
        if (typeof option.default === 'undefined') {
            return '';
        }

        if (['json', 'jsonb'].includes(option.type)) {
            return ` DEFAULT '${JSON.stringify(option.default)}'::${option.type} `;
        }

        if (['boolean', 'bigint', 'int'].includes(option.type)) {
            return ` DEFAULT ${option.default.toString().toUpperCase()} `;
        }

        return ` DEFAULT '${option.default}' `;
    }
}
