import { Injectable, OnModuleInit } from '@nestjs/common';
import { McpToolRegistry } from '@onivoro/server-mcp';
import { McpAuditInterceptor } from './mcp-audit-interceptor.service';

@Injectable()
export class McpAuditInterceptorRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: McpToolRegistry,
    private readonly interceptor: McpAuditInterceptor,
  ) {}

  onModuleInit() {
    this.registry.registerInterceptor(this.interceptor);
  }
}
