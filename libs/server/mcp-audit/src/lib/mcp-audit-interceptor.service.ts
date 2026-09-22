import { Inject, Injectable, Logger } from '@nestjs/common';
import { McpToolContext, McpToolInterceptor } from '@onivoro/server-mcp';
import {
  MCP_AUDIT_EMAIL_RESOLVER,
  MCP_AUDIT_EVENT_RESOLVER,
  MCP_AUDIT_SINK,
} from './mcp-audit.tokens';
import { McpAuditEmailResolver } from './mcp-audit-email-resolver.interface';
import { McpAuditEventResolver } from './mcp-audit-event-resolver.interface';
import { McpAuditSink } from './mcp-audit-sink.interface';

@Injectable()
export class McpAuditInterceptor implements McpToolInterceptor {
  private readonly logger = new Logger(McpAuditInterceptor.name);

  constructor(
    @Inject(MCP_AUDIT_EMAIL_RESOLVER)
    private readonly emailResolver: McpAuditEmailResolver,
    @Inject(MCP_AUDIT_EVENT_RESOLVER)
    private readonly eventResolver: McpAuditEventResolver,
    @Inject(MCP_AUDIT_SINK)
    private readonly sink: McpAuditSink,
  ) {}

  async intercept(
    context: McpToolContext,
    next: () => Promise<unknown>,
  ): Promise<unknown> {
    const result = await next();

    await this.writeAuditEvent(context, result);

    return result;
  }

  private async writeAuditEvent(context: McpToolContext, result: unknown) {
    try {
      const [accessEmail, resolvedEvent] = await Promise.all([
        this.emailResolver.resolveEmail(context),
        this.eventResolver.resolveAuditEvent(context, result),
      ]);

      if (!accessEmail || !resolvedEvent) {
        return;
      }

      await this.sink.writeAuditEvent({
        accessEmail,
        accessType: resolvedEvent.accessType,
        resourceType: resolvedEvent.resourceType,
        resourceIds: this.cleanResourceIds(resolvedEvent.resourceIds),
        toolName: context.toolName,
        context,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      this.logger.warn(
        `MCP audit logging failed for ${context.toolName}: ${message}`,
      );
    }
  }

  private cleanResourceIds(
    resourceIds: Array<string | number | null | undefined> | undefined,
  ): Array<string | number> {
    return (resourceIds ?? []).filter(
      (resourceId): resourceId is string | number =>
        typeof resourceId === 'string' || typeof resourceId === 'number',
    );
  }
}
