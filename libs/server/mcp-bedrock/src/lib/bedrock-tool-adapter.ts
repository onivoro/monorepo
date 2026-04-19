import { Injectable } from '@nestjs/common';
import { McpToolRegistry } from '@onivoro/server-mcp';
import {
  resolveBedrockName,
  toBedrockToolDefinition,
  type BedrockToolDefinition,
} from './bedrock-schema-converters';

@Injectable()
export class BedrockToolAdapter {
  constructor(private readonly registry: McpToolRegistry) {}

  private buildNameMap(): Map<string, string> {
    const map = new Map<string, string>();
    for (const { metadata } of this.registry.getTools()) {
      map.set(resolveBedrockName(metadata), metadata.name);
    }
    return map;
  }

  toBedrockTools(): BedrockToolDefinition[] {
    return this.registry.getTools().map((entry) =>
      toBedrockToolDefinition(entry.metadata),
    );
  }

  resolveBedrockToolName(bedrockName: string): string | undefined {
    return this.buildNameMap().get(bedrockName);
  }

  async executeToolBedrock(
    bedrockName: string,
    params: Record<string, unknown>,
  ): Promise<string> {
    const mcpName = this.buildNameMap().get(bedrockName);
    if (!mcpName) {
      throw new Error(
        `No MCP tool found for Bedrock name "${bedrockName}".`,
      );
    }
    const result = await this.registry.executeTool(mcpName, params);
    return typeof result === 'string' ? result : JSON.stringify(result);
  }
}
