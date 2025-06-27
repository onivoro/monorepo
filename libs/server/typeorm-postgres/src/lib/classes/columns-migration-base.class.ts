import { MigrationInterface, QueryRunner, TableColumnOptions } from "typeorm";
import { SqlWriter } from "./sql-writer.class";

export class ColumnsMigrationBase implements MigrationInterface {
    constructor(
        public table: string,
        public options: TableColumnOptions[],
    ) { }

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(SqlWriter.addColumns(this.table, this.options));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(SqlWriter.dropColumns(this.table, this.options));
    }
}
