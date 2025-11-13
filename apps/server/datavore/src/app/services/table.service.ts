import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { DatabaseSchemaService, DatabaseInfo } from './database-schema.service';
import { HtmlGeneratorService } from './html-generator.service';

interface QueryExecution {
  queryRunner: QueryRunner;
  startTime: number;
}

@Injectable()
export class TableService {
  private activeQueries: Map<string, QueryExecution> = new Map();

  constructor(
    private readonly dataSource: DataSource,
    private readonly databaseSchemaService: DatabaseSchemaService,
    private readonly htmlGeneratorService: HtmlGeneratorService
  ) { }

  /**
   * Get database information for debugging
   */
  async getDatabaseInfo(dataSource: DataSource): Promise<DatabaseInfo> {
    return this.databaseSchemaService.getDatabaseInfo(dataSource);
  }

  async getTables(dataSource: DataSource): Promise<string> {
    try {
      const tables = await this.databaseSchemaService.getTables(dataSource);
      return this.htmlGeneratorService.generateTablesListHtml(tables);
    } catch (error) {
      console.error('Error getting tables:', error);
      return this.htmlGeneratorService.generateErrorHtml(`loading tables: ${error.message}`);
    }
  }

  async getTableData(dataSource: DataSource, tableName: string): Promise<string> {
    try {
      const data = await this.databaseSchemaService.getTableData(dataSource, tableName);
      return this.htmlGeneratorService.generateTableDataHtml(tableName, data);
    } catch (error) {
      return this.htmlGeneratorService.generateErrorHtml(`loading table data: ${error.message}`);
    }
  }

  async getTableStructure(dataSource: DataSource, tableName: string): Promise<string> {
    try {
      const structure = await this.databaseSchemaService.getTableStructure(dataSource, tableName);
      return this.htmlGeneratorService.generateTableStructureHtml(structure);
    } catch (error) {
      return this.htmlGeneratorService.generateErrorHtml(`loading table structure: ${error.message}`);
    }
  }

  async executeQuery(dataSource: DataSource, query: string, queryId?: string): Promise<{ html: string; rowCount: number; elapsedMs: number }> {
    const startTime = Date.now();
    const queryRunner = dataSource.createQueryRunner();

    if (queryId) {
      this.activeQueries.set(queryId, { queryRunner, startTime });
    }

    try {
      await queryRunner.connect();
      const results = await queryRunner.query(query);
      const resultsArray = Array.isArray(results) ? results : [];
      const rowCount = resultsArray.length;
      const elapsedMs = Date.now() - startTime;

      const html = this.htmlGeneratorService.generateQueryResultsHtml(resultsArray);

      return { html, rowCount, elapsedMs };
    } catch (error) {
      const elapsedMs = Date.now() - startTime;
      return {
        html: this.htmlGeneratorService.generateErrorHtml(`Query error: ${error.message}`),
        rowCount: 0,
        elapsedMs
      };
    } finally {
      if (queryId) {
        this.activeQueries.delete(queryId);
      }
      await queryRunner.release();
    }
  }

  async cancelQuery(queryId: string): Promise<boolean> {
    const execution = this.activeQueries.get(queryId);
    if (!execution) {
      return false;
    }

    try {
      // Get the connection and cancel the query
      const connection = execution.queryRunner.connection;
      const dbType = connection.options.type;

      if (dbType === 'postgres') {
        // For PostgreSQL, we need to get the process ID and cancel it
        const processInfo = await execution.queryRunner.query(
          'SELECT pg_backend_pid() as pid'
        );
        if (processInfo && processInfo[0]?.pid) {
          await connection.query(
            `SELECT pg_cancel_backend(${processInfo[0].pid})`
          );
        }
      } else if (dbType === 'mysql') {
        // For MySQL, get the connection ID and kill it
        const processInfo = await execution.queryRunner.query(
          'SELECT CONNECTION_ID() as id'
        );
        if (processInfo && processInfo[0]?.id) {
          await connection.query(`KILL QUERY ${processInfo[0].id}`);
        }
      }

      await execution.queryRunner.release();
      this.activeQueries.delete(queryId);
      return true;
    } catch (error) {
      console.error('Error cancelling query:', error);
      return false;
    }
  }
}
