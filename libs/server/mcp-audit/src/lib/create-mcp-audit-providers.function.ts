import { Provider, Type } from '@nestjs/common';
import { McpAuditEmailResolver } from './mcp-audit-email-resolver.interface';
import { McpAuditEventResolver } from './mcp-audit-event-resolver.interface';
import { McpAuditInterceptorRegistrar } from './mcp-audit-interceptor-registrar.service';
import { McpAuditInterceptor } from './mcp-audit-interceptor.service';
import { McpAuditSink } from './mcp-audit-sink.interface';
import {
  MCP_AUDIT_EMAIL_RESOLVER,
  MCP_AUDIT_EVENT_RESOLVER,
  MCP_AUDIT_SINK,
} from './mcp-audit.tokens';
import { McpAuthInfoEmailResolver } from './mcp-auth-info-email-resolver.service';

export interface CreateMcpAuditProvidersConfig {
  eventResolver: Type<McpAuditEventResolver>;
  sink: Type<McpAuditSink>;
  emailResolver?: Type<McpAuditEmailResolver>;
}

export function createMcpAuditProviders({
  emailResolver = McpAuthInfoEmailResolver,
  eventResolver,
  sink,
}: CreateMcpAuditProvidersConfig): Provider[] {
  return [
    emailResolver,
    eventResolver,
    sink,
    { provide: MCP_AUDIT_EMAIL_RESOLVER, useExisting: emailResolver },
    { provide: MCP_AUDIT_EVENT_RESOLVER, useExisting: eventResolver },
    { provide: MCP_AUDIT_SINK, useExisting: sink },
    McpAuditInterceptor,
    McpAuditInterceptorRegistrar,
  ];
}
