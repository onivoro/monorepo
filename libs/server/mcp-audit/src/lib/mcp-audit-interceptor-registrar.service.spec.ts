import { McpAuditInterceptorRegistrar } from './mcp-audit-interceptor-registrar.service';

describe(McpAuditInterceptorRegistrar.name, () => {
  it('registers the audit interceptor with the MCP registry', () => {
    const registry = { registerInterceptor: jest.fn() };
    const interceptor = { intercept: jest.fn() };
    const registrar = new McpAuditInterceptorRegistrar(
      registry as any,
      interceptor as any,
    );

    registrar.onModuleInit();

    expect(registry.registerInterceptor).toHaveBeenCalledWith(interceptor);
  });
});
