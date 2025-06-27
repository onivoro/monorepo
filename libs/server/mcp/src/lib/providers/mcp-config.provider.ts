import { Provider } from '@nestjs/common';
import { McpServerConfig } from '../interfaces/mcp-config.interface';

export const MCP_CONFIG_TOKEN = 'MCP_CONFIG';

export const createMcpConfigProvider = (config: McpServerConfig): Provider => ({
  provide: MCP_CONFIG_TOKEN,
  useValue: config,
});

export const defaultMcpConfig: McpServerConfig = {
  name: 'mcp-server',
  version: '1.0.0',
  description: 'MCP Server',
  author: '',
  homepage: '',
  authentication: {
    type: 'api-key',
    description: 'Requires API key authentication via x-api-key header',
    required: true
  },
};