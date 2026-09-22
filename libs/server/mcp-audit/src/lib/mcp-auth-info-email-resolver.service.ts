import { Injectable } from '@nestjs/common';
import { McpToolContext } from '@onivoro/server-mcp';
import { McpAuditEmailResolver } from './mcp-audit-email-resolver.interface';

@Injectable()
export class McpAuthInfoEmailResolver implements McpAuditEmailResolver {
  resolveEmail(context: McpToolContext): string | undefined {
    const email = context.authInfo?.extra?.email;

    return typeof email === 'string' && email ? email : undefined;
  }
}
