import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabaseSchemaService, DatabaseInfo } from './database-schema.service';
import { HtmlGeneratorService } from './html-generator.service';

@Injectable()
export class TableService {
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

  async executeQuery(dataSource: DataSource, query: string): Promise<string> {
    try {
      const results = await this.databaseSchemaService.executeQuery(dataSource, query);
      return this.htmlGeneratorService.generateQueryResultsHtml(results);
    } catch (error) {
      return this.htmlGeneratorService.generateErrorHtml(`Query error: ${error.message}`);
    }
  }
}
