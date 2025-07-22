import { Body, Controller, Post } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TableService } from '../services/table.service';

@Controller('api/query')
export class QueryController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tableService: TableService,
  ) { }

  @Post()
  async get(@Body() body: { query: string }) {
    return await this.tableService.executeQuery(this.dataSource, body.query);
  }
}