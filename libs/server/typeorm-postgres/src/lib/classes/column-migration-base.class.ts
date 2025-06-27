import { MigrationInterface, QueryRunner, TableColumnOptions } from "typeorm";
import { SqlWriter } from "./sql-writer.class";

export class ColumnMigrationBase implements MigrationInterface {
    constructor(
        public table: string,
        public option: TableColumnOptions,
    ) { }

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(SqlWriter.addColumn(this.table, this.option));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(SqlWriter.dropColumn(this.table, this.option));
    }
}
