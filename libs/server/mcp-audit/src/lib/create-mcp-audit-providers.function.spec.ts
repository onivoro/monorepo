import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { McpToolContext, McpToolRegistry } from '@onivoro/server-mcp';
import { createMcpAuditProviders } from './create-mcp-audit-providers.function';
import { McpAuditEmailResolver } from './mcp-audit-email-resolver.interface';
import {
  McpAuditEventResolver,
  McpResolvedAuditEvent,
} from './mcp-audit-event-resolver.interface';
import { McpAuditInterceptor } from './mcp-audit-interceptor.service';
import { McpAuditInterceptorRegistrar } from './mcp-audit-interceptor-registrar.service';
import { McpAuditEvent, McpAuditSink } from './mcp-audit-sink.interface';
import {
  MCP_AUDIT_EMAIL_RESOLVER,
  MCP_AUDIT_EVENT_RESOLVER,
  MCP_AUDIT_SINK,
} from './mcp-audit.tokens';
import { McpAuthInfoEmailResolver } from './mcp-auth-info-email-resolver.service';

@Injectable()
class TestEventResolver implements McpAuditEventResolver {
  resolveAuditEvent(): McpResolvedAuditEvent {
    return { accessType: 'read', resourceType: 'invoice', resourceIds: [7] };
  }
}

@Injectable()
class TestSink implements McpAuditSink {
  readonly events: McpAuditEvent[] = [];

  writeAuditEvent(event: McpAuditEvent) {
    this.events.push(event);
  }
}

@Injectable()
class TestEmailResolver implements McpAuditEmailResolver {
  resolveEmail() {
    return 'custom@example.com';
  }
}

describe(createMcpAuditProviders.name, () => {
  const context: McpToolContext = {
    toolName: 'get-invoice',
    params: {},
    metadata: { name: 'get-invoice', description: 'Get invoice' },
    authInfo: {
      token: 'token',
      clientId: 'client',
      scopes: [],
      extra: { email: 'auth@example.com' },
    },
  };

  async function compile(
    providers: ReturnType<typeof createMcpAuditProviders>,
  ) {
    const registry = { registerInterceptor: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ...providers,
        { provide: McpToolRegistry, useValue: registry },
      ],
    }).compile();

    return { moduleRef, registry };
  }

  it('returns the resolver classes, token aliases, interceptor and registrar', () => {
    const providers = createMcpAuditProviders({
      eventResolver: TestEventResolver,
      sink: TestSink,
    });

    expect(providers).toEqual([
      McpAuthInfoEmailResolver,
      TestEventResolver,
      TestSink,
      {
        provide: MCP_AUDIT_EMAIL_RESOLVER,
        useExisting: McpAuthInfoEmailResolver,
      },
      { provide: MCP_AUDIT_EVENT_RESOLVER, useExisting: TestEventResolver },
      { provide: MCP_AUDIT_SINK, useExisting: TestSink },
      McpAuditInterceptor,
      McpAuditInterceptorRegistrar,
    ]);
  });

  it('defaults the email resolver to McpAuthInfoEmailResolver and wires the tokens via DI', async () => {
    const { moduleRef } = await compile(
      createMcpAuditProviders({
        eventResolver: TestEventResolver,
        sink: TestSink,
      }),
    );

    expect(moduleRef.get(MCP_AUDIT_EMAIL_RESOLVER)).toBe(
      moduleRef.get(McpAuthInfoEmailResolver),
    );
    expect(moduleRef.get(MCP_AUDIT_EVENT_RESOLVER)).toBe(
      moduleRef.get(TestEventResolver),
    );
    expect(moduleRef.get(MCP_AUDIT_SINK)).toBe(moduleRef.get(TestSink));
  });

  it('uses a custom email resolver when provided', async () => {
    const { moduleRef } = await compile(
      createMcpAuditProviders({
        eventResolver: TestEventResolver,
        sink: TestSink,
        emailResolver: TestEmailResolver,
      }),
    );

    expect(moduleRef.get(MCP_AUDIT_EMAIL_RESOLVER)).toBeInstanceOf(
      TestEmailResolver,
    );

    const interceptor = moduleRef.get(McpAuditInterceptor);
    await interceptor.intercept(context, async () => 'ok');

    expect(moduleRef.get(TestSink).events[0].accessEmail).toBe(
      'custom@example.com',
    );
  });

  it('registers the interceptor with the registry on module init and audits tool calls end to end', async () => {
    const { moduleRef, registry } = await compile(
      createMcpAuditProviders({
        eventResolver: TestEventResolver,
        sink: TestSink,
      }),
    );

    await moduleRef.init();

    const interceptor = moduleRef.get(McpAuditInterceptor);
    expect(registry.registerInterceptor).toHaveBeenCalledWith(interceptor);

    await expect(
      interceptor.intercept(context, async () => ({ id: 7 })),
    ).resolves.toEqual({
      id: 7,
    });

    expect(moduleRef.get(TestSink).events).toEqual([
      {
        accessEmail: 'auth@example.com',
        accessType: 'read',
        resourceType: 'invoice',
        resourceIds: [7],
        toolName: 'get-invoice',
        context,
      },
    ]);
  });
});
