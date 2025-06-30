# @onivoro/server-mcp

A comprehensive Model Context Protocol (MCP) server implementation for NestJS applications, providing tools for building AI-powered applications with standardized tool discovery, validation, and execution capabilities.

## Installation

```bash
npm install @onivoro/server-mcp
```

## Features

- **MCP Server Module**: Complete NestJS module for MCP integration
- **Tool Discovery**: Automatic tool discovery and registration
- **Tool Decorators**: Easy-to-use decorators for defining MCP tools
- **Validation Pipeline**: Built-in validation for tool inputs and outputs
- **Error Handling**: Comprehensive error handling for MCP operations
- **Configuration Management**: Flexible configuration system
- **RESTful API**: HTTP endpoints for MCP tool interaction
- **Type Safety**: Full TypeScript support with strong typing

## Quick Start

### Import the Module

```typescript
import { ServerMcpModule } from '@onivoro/server-mcp';

@Module({
  imports: [ServerMcpModule.forRoot({
    serverName: 'My MCP Server',
    serverVersion: '1.0.0',
    tools: {
      autoDiscover: true,
      discoveryPaths: ['./src/**/*.service.ts']
    }
  })],
})
export class AppModule {}
```

### Define MCP Tools

```typescript
import { Tool } from '@onivoro/server-mcp';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CalculatorService {
  @Tool({
    name: 'add',
    description: 'Add two numbers together',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number', description: 'First number' },
        b: { type: 'number', description: 'Second number' }
      },
      required: ['a', 'b']
    }
  })
  async add(input: { a: number; b: number }): Promise<{ result: number }> {
    return { result: input.a + input.b };
  }

  @Tool({
    name: 'multiply',
    description: 'Multiply two numbers',
    inputSchema: {
      type: 'object',
      properties: {
        x: { type: 'number' },
        y: { type: 'number' }
      },
      required: ['x', 'y']
    }
  })
  async multiply(input: { x: number; y: number }): Promise<{ result: number }> {
    return { result: input.x * input.y };
  }
}
```

### Using the MCP Controller

```typescript
import { Controller, Get, Post, Body } from '@nestjs/common';
import { McpController } from '@onivoro/server-mcp';

// The McpController is automatically available when importing ServerMcpModule
// It provides endpoints for:
// GET /mcp/tools - List available tools
// POST /mcp/tools/:name - Execute a specific tool
// GET /mcp/server-info - Get server information
```

## Configuration

### Basic Configuration

```typescript
import { McpConfig } from '@onivoro/server-mcp';

const config: McpConfig = {
  serverName: 'My Application',
  serverVersion: '1.0.0',
  tools: {
    autoDiscover: true,
    discoveryPaths: ['./src/**/*.service.ts'],
    maxConcurrentExecutions: 10
  },
  validation: {
    enableInputValidation: true,
    enableOutputValidation: true,
    strictMode: true
  },
  logging: {
    enableToolLogging: true,
    logLevel: 'info'
  }
};

@Module({
  imports: [ServerMcpModule.forRoot(config)],
})
export class AppModule {}
```

### Advanced Configuration

```typescript
import { ServerMcpModule } from '@onivoro/server-mcp';

@Module({
  imports: [
    ServerMcpModule.forRootAsync({
      useFactory: async (configService: ConfigService) => ({
        serverName: configService.get('MCP_SERVER_NAME'),
        serverVersion: configService.get('MCP_SERVER_VERSION'),
        tools: {
          autoDiscover: configService.get('MCP_AUTO_DISCOVER', true),
          discoveryPaths: configService.get('MCP_DISCOVERY_PATHS', ['./src/**/*.service.ts']),
          maxConcurrentExecutions: configService.get('MCP_MAX_CONCURRENT', 10)
        }
      }),
      inject: [ConfigService]
    })
  ],
})
export class AppModule {}
```

## Usage Examples

### Complex Tool Definition

```typescript
import { Tool } from '@onivoro/server-mcp';
import { Injectable } from '@nestjs/common';

@Injectable()
export class FileService {
  @Tool({
    name: 'read-file',
    description: 'Read content from a file',
    inputSchema: {
      type: 'object',
      properties: {
        path: { 
          type: 'string', 
          description: 'File path to read',
          pattern: '^[a-zA-Z0-9/_.-]+$'
        },
        encoding: { 
          type: 'string', 
          enum: ['utf8', 'base64'], 
          default: 'utf8' 
        }
      },
      required: ['path']
    },
    outputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string' },
        size: { type: 'number' },
        lastModified: { type: 'string', format: 'date-time' }
      }
    }
  })
  async readFile(input: { path: string; encoding?: string }) {
    // Implementation here
    return {
      content: 'file content',
      size: 1024,
      lastModified: new Date().toISOString()
    };
  }
}
```

### Tool with Validation

```typescript
import { Tool, McpValidationPipe } from '@onivoro/server-mcp';
import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ValidationService {
  @Tool({
    name: 'validate-email',
    description: 'Validate email address format',
    inputSchema: {
      type: 'object',
      properties: {
        email: { 
          type: 'string', 
          format: 'email',
          description: 'Email address to validate'
        }
      },
      required: ['email']
    }
  })
  async validateEmail(input: { email: string }): Promise<{ valid: boolean; reason?: string }> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const valid = emailRegex.test(input.email);
    
    return {
      valid,
      reason: valid ? undefined : 'Invalid email format'
    };
  }
}
```

### Error Handling in Tools

```typescript
import { Tool, McpError } from '@onivoro/server-mcp';
import { Injectable } from '@nestjs/common';

@Injectable()
export class DatabaseService {
  @Tool({
    name: 'get-user',
    description: 'Get user by ID',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', format: 'uuid' }
      },
      required: ['userId']
    }
  })
  async getUser(input: { userId: string }) {
    try {
      // Database query logic
      const user = await this.findUserById(input.userId);
      
      if (!user) {
        throw new McpError('User not found', 'USER_NOT_FOUND', 404);
      }
      
      return user;
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError('Database error', 'DATABASE_ERROR', 500);
    }
  }
}
```

### Tool Discovery Service

```typescript
import { Injectable } from '@nestjs/common';
import { ToolDiscoveryService } from '@onivoro/server-mcp';

@Injectable()
export class CustomToolDiscovery {
  constructor(private toolDiscovery: ToolDiscoveryService) {}

  async getAvailableTools() {
    return this.toolDiscovery.discoverTools();
  }

  async getToolByName(name: string) {
    return this.toolDiscovery.getToolMetadata(name);
  }
}
```

## API Reference

### Core Services

#### McpCoreService

Central service for MCP operations:

```typescript
@Injectable()
export class McpCoreService {
  async executeTool(name: string, input: any): Promise<any>
  async listTools(): Promise<ToolMetadata[]>
  async getServerInfo(): Promise<McpServerInfo>
}
```

#### ToolDiscoveryService

Service for discovering and managing tools:

```typescript
@Injectable()
export class ToolDiscoveryService {
  async discoverTools(): Promise<ToolMetadata[]>
  async getToolMetadata(name: string): Promise<ToolMetadata>
  async registerTool(metadata: ToolMetadata): Promise<void>
}
```

### Decorators

#### @Tool

Decorator for marking methods as MCP tools:

```typescript
@Tool({
  name: string;                    // Tool name (required)
  description: string;             // Tool description (required)
  inputSchema?: JSONSchema;        // Input validation schema
  outputSchema?: JSONSchema;       // Output validation schema
  tags?: string[];                 // Tool tags for categorization
  deprecated?: boolean;            // Mark tool as deprecated
})
```

### Configuration Interfaces

#### McpConfig

```typescript
interface McpConfig {
  serverName: string;
  serverVersion: string;
  tools: {
    autoDiscover: boolean;
    discoveryPaths: string[];
    maxConcurrentExecutions?: number;
  };
  validation?: {
    enableInputValidation?: boolean;
    enableOutputValidation?: boolean;
    strictMode?: boolean;
  };
  logging?: {
    enableToolLogging?: boolean;
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
  };
}
```

### Error Classes

#### McpError

Custom error class for MCP operations:

```typescript
class McpError extends Error {
  constructor(
    message: string,
    code: string,
    statusCode: number = 500
  )
}
```

## REST API Endpoints

When using the MCP controller, the following endpoints are available:

### GET /mcp/server-info

Get server information and capabilities.

**Response:**
```json
{
  "name": "My MCP Server",
  "version": "1.0.0",
  "capabilities": {
    "tools": true,
    "validation": true
  }
}
```

### GET /mcp/tools

List all available tools.

**Response:**
```json
{
  "tools": [
    {
      "name": "add",
      "description": "Add two numbers together",
      "inputSchema": { ... },
      "outputSchema": { ... }
    }
  ]
}
```

### POST /mcp/tools/:name

Execute a specific tool.

**Request Body:**
```json
{
  "input": {
    "a": 5,
    "b": 3
  }
}
```

**Response:**
```json
{
  "result": {
    "result": 8
  },
  "metadata": {
    "executionTime": 12,
    "toolName": "add"
  }
}
```

## Best Practices

1. **Schema Validation**: Always define input and output schemas for tools
2. **Error Handling**: Use McpError for consistent error responses
3. **Tool Naming**: Use descriptive, kebab-case names for tools
4. **Documentation**: Provide clear descriptions for tools and parameters
5. **Type Safety**: Leverage TypeScript for input/output type definitions
6. **Testing**: Write unit tests for all MCP tools
7. **Logging**: Enable tool logging for debugging and monitoring

## Testing

```typescript
import { Test } from '@nestjs/testing';
import { ServerMcpModule, McpCoreService } from '@onivoro/server-mcp';

describe('MCP Tools', () => {
  let mcpService: McpCoreService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [ServerMcpModule.forRoot(testConfig)],
    }).compile();

    mcpService = module.get<McpCoreService>(McpCoreService);
  });

  it('should execute add tool', async () => {
    const result = await mcpService.executeTool('add', { a: 2, b: 3 });
    expect(result.result).toBe(5);
  });
});
```

## License

This library is part of the Onivoro monorepo ecosystem.