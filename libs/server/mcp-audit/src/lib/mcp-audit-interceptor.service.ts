import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  McpAccessDeniedError,
  McpToolContext,
  McpToolInterceptor,
} from '@onivoro/server-mcp';
import {
  MCP_AUDIT_EMAIL_RESOLVER,
  MCP_AUDIT_EVENT_RESOLVER,
  MCP_AUDIT_SINK,
} from './mcp-audit.tokens';
import { McpAuditEmailResolver } from './mcp-audit-email-resolver.interface';
import { McpAuditEventResolver } from './mcp-audit-event-resolver.interface';
import {
  McpAuditContext,
  McpAuditOutcome,
  McpAuditSink,
} from './mcp-audit-sink.interface';

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
    let result: unknown;
    try {
      result = await next();
    } catch (error) {
      await this.writeAuditEvent(
        context,
        undefined,
        'error',
        errorMessage(error),
      );
      throw error;
    }

    // An `inputRequired(...)` round isn't the end of the call: the client answers and calls
    // again, and that call is audited.
    if (isInputRequiredResult(result)) return result;

    const failure = isErrorResult(result) ? errorResultText(result) : undefined;
    await this.writeAuditEvent(
      context,
      result,
      failure === undefined ? 'success' : 'error',
      failure,
    );

    return result;
  }

  async onRejected(context: McpToolContext, error: unknown): Promise<void> {
    await this.writeAuditEvent(
      context,
      undefined,
      error instanceof McpAccessDeniedError ? 'denied' : 'rejected',
      errorMessage(error),
    );
  }

  private async writeAuditEvent(
    context: McpToolContext,
    result: unknown,
    outcome: McpAuditOutcome,
    error?: string,
  ) {
    try {
      const [accessEmail, resolvedEvent] = await Promise.all([
        this.emailResolver.resolveEmail(context),
        this.eventResolver.resolveAuditEvent(context, result, outcome),
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
        outcome,
        ...(error !== undefined && { error }),
        context: withoutToken(context),
      });
    } catch (sinkError) {
      const message =
        sinkError instanceof Error ? sinkError.message : 'Unknown error';

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

/** The context without the bearer token, which an audit record must never hold. */
function withoutToken(context: McpToolContext): McpAuditContext {
  if (!context.authInfo) return context;
  const { token: _token, ...authInfo } = context.authInfo;
  return { ...context, authInfo };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isInputRequiredResult(result: unknown): boolean {
  return (
    !!result &&
    typeof result === 'object' &&
    (result as { resultType?: unknown }).resultType === 'input_required'
  );
}

function isErrorResult(result: unknown): boolean {
  return (
    !!result &&
    typeof result === 'object' &&
    (result as { isError?: unknown }).isError === true
  );
}

function errorResultText(result: unknown): string {
  const content = (result as { content?: unknown }).content;
  const text = Array.isArray(content)
    ? content
        .filter(
          (block): block is { type: 'text'; text: string } =>
            !!block && block.type === 'text' && typeof block.text === 'string',
        )
        .map((block) => block.text)
        .join('\n')
    : '';
  return text || 'Tool execution failed';
}
