import { MigrationInterface, QueryRunner, TableColumn, TableColumnOptions } from "typeorm";
import { SqlWriter } from "./sql-writer.class";

export class UniqueIndexMigrationBase implements MigrationInterface {
    constructor(
        public table: string,
        public option: TableColumnOptions,
    ) { }

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(SqlWriter.createUniqueIndex(this.table, this.option.name));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(SqlWriter.dropIndex(SqlWriter.getIndexName(this.table, this.option.name)));
    }
}
