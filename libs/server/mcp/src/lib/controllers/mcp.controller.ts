import { All, Controller, Get, Req, Res } from '@nestjs/common';
import { McpCoreService } from '../services/mcp-core.service';

@Controller()
export class McpController {
  constructor(private readonly mcpCoreService: McpCoreService) {}

  @All('mcp')
  async handleMcp(@Req() req: any, @Res() res: any) {
    // Bypass NestJS response handling to preserve raw HTTP request/response
    // This is critical for MCP transport compatibility
    await this.mcpCoreService.handleMcpRequest(req, res);
  }

  @Get('info')
  getServerInfo() {
    return this.mcpCoreService.getServerInfo();
  }

  @Get('mcp-test')
  getMcpTest() {
    return {
      message: 'MCP endpoint available at /mcp',
      note: 'Use the /mcp endpoint for MCP requests'
    };
  }

  @Get('api/health')
  getHealth() {
    return {
      status: 'healthy',
      transport: 'HTTP',
      timestamp: new Date().toISOString()
    };
  }
}