import { Injectable } from '@nestjs/common';
import { McpToolRegistry } from '@onivoro/server-mcp';
import {
  McpToolCatalogEntry,
  McpToolCatalogRenderConfig,
  renderMcpToolCatalogHtml,
} from './mcp-tool-catalog.view';

@Injectable()
export class McpToolCatalogService {
  constructor(private readonly registry: McpToolRegistry) {}

  renderHtml(config: McpToolCatalogRenderConfig): string {
    return renderMcpToolCatalogHtml(this.listTools(), config);
  }

  listTools(): McpToolCatalogEntry[] {
    const metadataByName = new Map(
      this.registry.getTools().map(({ metadata }) => [metadata.name, metadata]),
    );

    return this.registry
      .getToolJsonSchemas()
      .map(({ name, description, jsonSchema }) => {
        const metadata = metadataByName.get(name);
        return {
          annotations: metadata?.annotations as
            | Record<string, unknown>
            | undefined,
          description,
          jsonSchema,
          name,
          title: metadata?.title,
        };
      });
  }
}
