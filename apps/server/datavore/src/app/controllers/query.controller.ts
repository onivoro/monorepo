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
  async execute(@Body() body: { query: string; queryId?: string }) {
    const result = await this.tableService.executeQuery(
      this.dataSource,
      body.query,
      body.queryId
    );
    return result;
  }

  @Post('cancel')
  async cancel(@Body() body: { queryId: string }) {
    const cancelled = await this.tableService.cancelQuery(body.queryId);
    return { cancelled };
  }
}