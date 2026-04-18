import { Injectable, Logger } from '@nestjs/common';
import type { McpToolMetadata, McpResourceMetadata, McpPromptMetadata } from './mcp.decorator';
import {
  toBedrockToolDefinition,
  mcpSchemaToJsonSchema,
  resolveBedrockName,
  type BedrockToolDefinition,
} from './mcp-schema-converters';

interface ToolEntry {
  metadata: McpToolMetadata;
  handler: (params: any) => Promise<any>;
}

interface ResourceEntry {
  metadata: McpResourceMetadata;
  handler: (...args: any[]) => Promise<any>;
}

interface PromptEntry {
  metadata: McpPromptMetadata;
  handler: (...args: any[]) => Promise<any>;
}

export interface McpToolResult {
  content: Array<{ type: 'text'; text: string }>;
}

@Injectable()
export class McpToolRegistry {
  private readonly logger = new Logger(McpToolRegistry.name);

  private readonly tools = new Map<string, ToolEntry>();
  private readonly resources = new Map<string, ResourceEntry>();
  private readonly prompts = new Map<string, PromptEntry>();

  // Reverse map: bedrockName → mcpName
  private readonly bedrockNameMap = new Map<string, string>();

  // -- Registration --

  registerTool(
    metadata: McpToolMetadata,
    handler: (params: any) => Promise<any>,
  ): void {
    if (this.tools.has(metadata.name)) {
      throw new Error(
        `MCP tool "${metadata.name}" is already registered. Tool names must be unique across all providers.`,
      );
    }
    this.tools.set(metadata.name, { metadata, handler });

    const bedrockName = resolveBedrockName(metadata);
    this.bedrockNameMap.set(bedrockName, metadata.name);

    this.logger.log(`Tool registered: ${metadata.name}`);
  }

  registerResource(
    metadata: McpResourceMetadata,
    handler: (...args: any[]) => Promise<any>,
  ): void {
    if (this.resources.has(metadata.name)) {
      throw new Error(
        `MCP resource "${metadata.name}" is already registered. Resource names must be unique across all providers.`,
      );
    }
    this.resources.set(metadata.name, { metadata, handler });
    this.logger.log(`Resource registered: ${metadata.name}`);
  }

  registerPrompt(
    metadata: McpPromptMetadata,
    handler: (...args: any[]) => Promise<any>,
  ): void {
    if (this.prompts.has(metadata.name)) {
      throw new Error(
        `MCP prompt "${metadata.name}" is already registered. Prompt names must be unique across all providers.`,
      );
    }
    this.prompts.set(metadata.name, { metadata, handler });
    this.logger.log(`Prompt registered: ${metadata.name}`);
  }

  // -- Introspection --

  getTools(): ReadonlyArray<ToolEntry> {
    return Array.from(this.tools.values());
  }

  getResources(): ReadonlyArray<ResourceEntry> {
    return Array.from(this.resources.values());
  }

  getPrompts(): ReadonlyArray<PromptEntry> {
    return Array.from(this.prompts.values());
  }

  getTool(name: string): ToolEntry | undefined {
    return this.tools.get(name);
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  resolveBedrockToolName(bedrockName: string): string | undefined {
    return this.bedrockNameMap.get(bedrockName);
  }

  // -- Execution --

  async executeTool(
    name: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    const entry = this.tools.get(name);
    if (!entry) {
      throw new Error(`MCP tool "${name}" is not registered.`);
    }
    return entry.handler(params);
  }

  async executeToolMcp(
    name: string,
    params: Record<string, unknown>,
  ): Promise<McpToolResult> {
    try {
      const result = await this.executeTool(name, params);

      if (
        result &&
        typeof result === 'object' &&
        (result as any).content
      ) {
        return result as McpToolResult;
      }

      return {
        content: [
          {
            type: 'text',
            text:
              typeof result === 'string'
                ? result
                : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      this.logger.error(`Error executing tool ${name}:`, error);
      return {
        content: [
          {
            type: 'text',
            text: `Error executing ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }

  async executeToolBedrock(
    bedrockName: string,
    params: Record<string, unknown>,
  ): Promise<string> {
    const mcpName = this.bedrockNameMap.get(bedrockName);
    if (!mcpName) {
      throw new Error(
        `No MCP tool found for Bedrock name "${bedrockName}".`,
      );
    }
    const result = await this.executeTool(mcpName, params);
    return typeof result === 'string' ? result : JSON.stringify(result);
  }

  // -- Schema Conversion --

  toBedrockTools(): BedrockToolDefinition[] {
    return this.getTools().map((entry) =>
      toBedrockToolDefinition(entry.metadata),
    );
  }

  getToolJsonSchemas(): Array<{
    name: string;
    description: string;
    jsonSchema: Record<string, unknown>;
  }> {
    return this.getTools().map((entry) => ({
      name: entry.metadata.name,
      description: entry.metadata.description,
      jsonSchema: mcpSchemaToJsonSchema(entry.metadata.schema),
    }));
  }
}
