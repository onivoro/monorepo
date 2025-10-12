# @onivoro/server-mcp

A Model Context Protocol (MCP) server implementation for NestJS applications, enabling AI models to interact with your application through standardized tool interfaces.

## Installation

```bash
npm install @onivoro/server-mcp @modelcontextprotocol/sdk
```

## Overview

This library provides:
- MCP server integration for NestJS
- HTTP transport for MCP requests
- Tool registration and discovery
- Built-in authentication support
- Server info and health endpoints

## Module Setup

```typescript
import { ServerMcpModule } from '@onivoro/server-mcp';

@Module({
  imports: [
    ServerMcpModule.configure({
      name: 'My MCP Server',
      version: '1.0.0',
      description: 'MCP server for my application',
      author: 'Your Name',
      homepage: 'https://example.com',
      authentication: {
        type: 'api-key',
        description: 'API key required',
        required: true
      }
    })
  ]
})
export class AppModule {}
```

## Configuration

The `McpServerConfig` interface accepts:

```typescript
interface McpServerConfig {
  name: string;                // Server name
  version: string;             // Server version
  description?: string;        // Server description
  author?: string;             // Author name
  homepage?: string;           // Homepage URL
  authentication?: {           // Authentication configuration
    type: string;
    description: string;
    required: boolean;
  };
  requiredHeaders?: string;    // Required headers (defaults to API key header)
}
```

## Using MCP Tools

### Tool Decorator

Mark methods as MCP tools using the `@Tool` decorator:

```typescript
import { Injectable } from '@nestjs/common';
import { Tool } from '@onivoro/server-mcp';
import { z } from 'zod';

@Injectable()
export class CalculatorService {
  @Tool(
    'add',
    'Add two numbers together',
    {
      a: z.number().describe('First number'),
      b: z.number().describe('Second number')
    }
  )
  async add(a: number, b: number): Promise<number> {
    return a + b;
  }

  @Tool(
    'multiply',
    'Multiply two numbers',
    {
      x: z.number(),
      y: z.number()
    }
  )
  async multiply(x: number, y: number): Promise<number> {
    return x * y;
  }
}
```

### Tool Registration

Tools must be registered with the MCP server. Use the `ToolDiscoveryService`:

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ToolDiscoveryService } from '@onivoro/server-mcp';

@Injectable()
export class ToolRegistrationService implements OnModuleInit {
  constructor(
    private toolDiscovery: ToolDiscoveryService,
    private calculatorService: CalculatorService
  ) {}

  async onModuleInit() {
    // Register tools from services
    await this.toolDiscovery.registerToolsFromService(this.calculatorService);
  }
}
```

## API Endpoints

The MCP controller provides these endpoints:

### /mcp (ALL methods)
Main MCP endpoint for handling MCP protocol requests. This is where AI models connect.

### GET /info
Get server information:
```json
{
  "name": "My MCP Server",
  "version": "1.0.0",
  "description": "MCP server for my application"
}
```

### GET /mcp-test
Test endpoint to verify MCP is available:
```json
{
  "message": "MCP endpoint available at /mcp",
  "note": "Use the /mcp endpoint for MCP requests"
}
```

### GET /api/health
Health check endpoint:
```json
{
  "status": "healthy",
  "transport": "HTTP",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Services

### McpCoreService

Core service handling MCP requests:

```typescript
import { Injectable } from '@nestjs/common';
import { McpCoreService } from '@onivoro/server-mcp';

@Injectable()
export class MyService {
  constructor(private mcpCore: McpCoreService) {}

  getServerInfo() {
    return this.mcpCore.getServerInfo();
  }

  async handleCustomMcpRequest(req: any, res: any) {
    await this.mcpCore.handleMcpRequest(req, res);
  }
}
```

### ToolDiscoveryService

Service for tool registration and discovery:

```typescript
import { ToolDiscoveryService } from '@onivoro/server-mcp';

// Register a tool manually
await this.toolDiscovery.registerTool({
  name: 'custom-tool',
  description: 'A custom tool',
  parameters: {
    input: 'string input parameter'
  }
});

// Get registered tools
const tools = this.toolDiscovery.getRegisteredTools();
```

## Error Handling

Use the `McpError` class for consistent error responses:

```typescript
import { McpError } from '@onivoro/server-mcp';

@Tool('divide', 'Divide two numbers')
async divide(a: number, b: number): Promise<number> {
  if (b === 0) {
    throw new McpError('Division by zero is not allowed');
  }
  return a / b;
}
```

## Helper Functions

The library includes helper functions in `mcp-helper.function`:

```typescript
import { createMcpResponse, createMcpContent } from '@onivoro/server-mcp';

// Create MCP content
const textContent = createMcpContent('text', 'Hello, world!');
const imageContent = createMcpContent('image', base64Data, 'image/png');

// Create MCP response
const response = createMcpResponse([textContent]);
```

## Complete Example

```typescript
import { Module, Injectable, OnModuleInit } from '@nestjs/common';
import { ServerMcpModule, Tool, ToolDiscoveryService, McpError } from '@onivoro/server-mcp';
import { z } from 'zod';

@Injectable()
export class WeatherService {
  @Tool(
    'get-weather',
    'Get current weather for a location',
    {
      location: z.string().describe('City name or coordinates')
    }
  )
  async getWeather(location: string) {
    // Simulated weather data
    if (!location) {
      throw new McpError('Location is required');
    }
    
    return {
      location,
      temperature: 72,
      condition: 'Sunny',
      humidity: 45
    };
  }
}

@Injectable()
export class ToolLoader implements OnModuleInit {
  constructor(
    private toolDiscovery: ToolDiscoveryService,
    private weatherService: WeatherService
  ) {}

  async onModuleInit() {
    await this.toolDiscovery.registerToolsFromService(this.weatherService);
  }
}

@Module({
  imports: [
    ServerMcpModule.configure({
      name: 'Weather API Server',
      version: '1.0.0',
      description: 'MCP server providing weather data'
    })
  ],
  providers: [WeatherService, ToolLoader]
})
export class AppModule {}
```

## Authentication

By default, the server expects an API key in the header specified by `requiredHeaders` (defaults to the value from `@onivoro/isomorphic-common`'s `apiKeyHeader`).

Configure authentication in the server config:

```typescript
ServerMcpModule.configure({
  // ... other config
  authentication: {
    type: 'api-key',
    description: 'Requires API key in x-api-key header',
    required: true
  },
  requiredHeaders: 'x-api-key'
})
```

## Important Notes

1. This library implements the Model Context Protocol for AI model interactions
2. The `/mcp` endpoint handles raw HTTP requests/responses for MCP transport compatibility
3. Tools must be registered with the server to be available to AI models
4. Zod schemas are used for parameter validation
5. The transport layer uses the MCP SDK's StreamableHTTPServerTransport

## License

MIT