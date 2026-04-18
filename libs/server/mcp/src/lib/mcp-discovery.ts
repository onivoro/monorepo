import { Logger } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { MetadataScanner } from '@nestjs/core/metadata-scanner';
import { MCP_TOOL_METADATA, MCP_RESOURCE_METADATA, MCP_PROMPT_METADATA } from './mcp.constants';
import type { McpToolMetadata, McpResourceMetadata, McpPromptMetadata } from './mcp.decorator';
import { McpToolRegistry } from './mcp-tool-registry';

export function discoverAndRegisterMcpEntities(
  discoveryService: DiscoveryService,
  metadataScanner: MetadataScanner,
  registry: McpToolRegistry,
  logger: Logger,
): void {
  const providers = discoveryService.getProviders();
  const controllers = discoveryService.getControllers();

  const instances = [...providers, ...controllers]
    .filter((wrapper) => wrapper.instance && typeof wrapper.instance === 'object')
    .map((wrapper) => ({ instance: wrapper.instance, name: wrapper.name }));

  for (const { instance, name } of instances) {
    const prototype = Object.getPrototypeOf(instance);
    const methodNames = metadataScanner.scanFromPrototype(
      instance,
      prototype,
      (methodName: string) => methodName,
    );

    for (const methodName of methodNames) {
      const methodRef = prototype[methodName];

      discoverTool(methodRef, prototype, methodName, instance, name, registry, logger);
      discoverResource(methodRef, prototype, methodName, instance, name, registry, logger);
      discoverPrompt(methodRef, prototype, methodName, instance, name, registry, logger);
    }
  }
}

function discoverTool(
  methodRef: any,
  prototype: any,
  methodName: string,
  instance: any,
  serviceName: string,
  registry: McpToolRegistry,
  logger: Logger,
) {
  const metadata: McpToolMetadata | undefined =
    Reflect.getMetadata(MCP_TOOL_METADATA, methodRef) ||
    Reflect.getMetadata(MCP_TOOL_METADATA, prototype, methodName);

  if (!metadata) return;

  logger.log(`Registering MCP tool: ${metadata.name} from ${serviceName}.${methodName}`);
  registry.registerTool(metadata, instance[methodName].bind(instance));
}

function discoverResource(
  methodRef: any,
  prototype: any,
  methodName: string,
  instance: any,
  serviceName: string,
  registry: McpToolRegistry,
  logger: Logger,
) {
  const metadata: McpResourceMetadata | undefined =
    Reflect.getMetadata(MCP_RESOURCE_METADATA, methodRef) ||
    Reflect.getMetadata(MCP_RESOURCE_METADATA, prototype, methodName);

  if (!metadata) return;

  logger.log(`Registering MCP resource: ${metadata.name} from ${serviceName}.${methodName}`);
  registry.registerResource(metadata, instance[methodName].bind(instance));
}

function discoverPrompt(
  methodRef: any,
  prototype: any,
  methodName: string,
  instance: any,
  serviceName: string,
  registry: McpToolRegistry,
  logger: Logger,
) {
  const metadata: McpPromptMetadata | undefined =
    Reflect.getMetadata(MCP_PROMPT_METADATA, methodRef) ||
    Reflect.getMetadata(MCP_PROMPT_METADATA, prototype, methodName);

  if (!metadata) return;

  logger.log(`Registering MCP prompt: ${metadata.name} from ${serviceName}.${methodName}`);
  registry.registerPrompt(metadata, instance[methodName].bind(instance));
}
