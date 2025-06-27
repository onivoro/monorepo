import { MigrationInterface, QueryRunner, TableColumnOptions } from "typeorm";
import { SqlWriter } from "./sql-writer.class";

export class TableMigrationBase implements MigrationInterface {
    constructor(
        public table: string,
        public options: TableColumnOptions[],
    ) { }

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(SqlWriter.createTable(this.table, this.options));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(SqlWriter.dropTable(this.table));
    }
}
