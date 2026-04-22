import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { McpToolRegistry, McpScopeGuard, McpGuardMetadata } from '@onivoro/server-mcp';

/**
 * Auto-discovers all scopes declared via `@McpGuard(McpScopeGuard, { scopes: [...] })`
 * across all registered tools.
 *
 * Subscribes to `McpToolRegistry.onRegistrationChange()` so dynamically registered
 * tools are picked up automatically.
 *
 * Requires `McpToolRegistry` to be available in the DI container (provided by
 * `McpHttpModule`, `McpStdioModule`, or `McpRegistryModule`). When no registry
 * is available, scope discovery is skipped and all methods return empty results.
 *
 * Useful for:
 * - Populating `scopes_supported` in Protected Resource Metadata (RFC 9728)
 * - Populating `scopes_supported` in OAuth Authorization Server Metadata
 * - Developer tooling and documentation
 */
@Injectable()
export class McpScopeRegistry implements OnModuleInit {
  private readonly scopes = new Set<string>();
  private unsubscribe?: () => void;

  constructor(@Optional() private readonly registry?: McpToolRegistry) {}

  onModuleInit(): void {
    if (!this.registry) return;
    this.scanExistingTools();
    this.unsubscribe = this.registry.onRegistrationChange((type, name) => {
      if (type === 'tool') this.scanTool(name);
    });
  }

  /** All unique scopes referenced across all `@McpGuard(McpScopeGuard, { scopes })` decorators. */
  getScopes(): ReadonlySet<string> {
    return this.scopes;
  }

  /** All unique scopes as a sorted array. */
  getScopesArray(): string[] {
    return Array.from(this.scopes).sort();
  }

  private scanExistingTools(): void {
    if (!this.registry) return;
    for (const tool of this.registry.getTools()) {
      this.extractScopesFromGuards(this.registry.getToolGuards(tool.metadata.name));
    }
  }

  private scanTool(name: string): void {
    if (!this.registry) return;
    this.extractScopesFromGuards(this.registry.getToolGuards(name));
  }

  private extractScopesFromGuards(guards: ReadonlyArray<McpGuardMetadata>): void {
    for (const guard of guards) {
      if (guard.guardClass === McpScopeGuard && guard.config?.scopes) {
        for (const scope of guard.config.scopes as string[]) {
          this.scopes.add(scope);
        }
      }
    }
  }
}
